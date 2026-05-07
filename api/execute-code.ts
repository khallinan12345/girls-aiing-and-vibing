// api/execute-code.ts — Real E2B code execution
//
// Uses @e2b/code-interpreter to run Python and JavaScript in isolated sandboxes.
// Each request spins up a fresh sandbox, executes the code, and closes it.
// Sandboxes are ephemeral — no state persists between requests.
//
// Environment variable required: E2B_API_KEY

import { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@e2b/code-interpreter';

interface ExecutionRequest {
  code: string;
  language: 'python' | 'javascript';
  timeout?: number;
}

interface ExecutionResult {
  output?: string;
  error?: string;
  executionTime: number;
  success: boolean;
}

// ─── Security validation ──────────────────────────────────────────────────────
// E2B runs code in an isolated container so the risk surface is low,
// but we still block the most obviously dangerous patterns for both languages.

const DANGEROUS_PYTHON = [
  /subprocess.*shell\s*=\s*True/gi,
  /__import__\s*\(\s*['"]os['"]\s*\).*system/gi,
];

const DANGEROUS_JS = [
  /require\s*\(\s*['"]child_process['"]\s*\)/gi,
  /process\.exit/gi,
];

function validateAndSanitizeCode(code: string, language: string): string {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid code input');
  }
  if (code.length > 10_000) {
    throw new Error('Code too long (max 10,000 characters)');
  }

  const patterns = language === 'python' ? DANGEROUS_PYTHON : DANGEROUS_JS;
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      throw new Error('Potentially dangerous code pattern detected');
    }
  }

  return code.trim();
}

// ─── E2B execution ────────────────────────────────────────────────────────────

async function executeWithE2B(
  code: string,
  language: 'python' | 'javascript',
  timeoutMs = 15_000,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const apiKey    = process.env.E2B_API_KEY;

  if (!apiKey) {
    throw new Error('E2B_API_KEY is not configured');
  }

  // Vercel functions have a max duration — keep sandbox timeout well under it
  const sandboxTimeout = Math.min(timeoutMs, 20_000);

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create({ apiKey, timeoutMs: sandboxTimeout });

    const execution = await sandbox.runCode(code, {
      language: language === 'javascript' ? 'js' : 'python',
    });

    const executionTime = Date.now() - startTime;

    // Collect stdout lines
    const stdoutLines = execution.logs?.stdout ?? [];
    const stderrLines = execution.logs?.stderr ?? [];

    // E2B surfaces errors in execution.error
    if (execution.error) {
      return {
        error:         `${execution.error.name}: ${execution.error.value}\n${execution.error.traceback ?? ''}`.trim(),
        executionTime,
        success:       false,
      };
    }

    // Combine stdout + any rich text results (e.g. repr of last expression)
    const outputParts: string[] = [];
    if (stdoutLines.length)  outputParts.push(stdoutLines.join(''));
    if (stderrLines.length)  outputParts.push(stderrLines.join(''));

    // If there are rich display results (e.g. a final expression value), append them
    for (const result of execution.results ?? []) {
      if (result.text && !outputParts.join('').includes(result.text)) {
        outputParts.push(result.text);
      }
    }

    const output = outputParts.join('\n').trim();

    return {
      output:        output || '(no output)',
      executionTime,
      success:       true,
    };

  } finally {
    // Always close the sandbox — each one costs money while open
    if (sandbox) {
      await sandbox.kill().catch(() => {}); // swallow close errors
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, language, timeout }: ExecutionRequest = req.body;

    if (!code || !language)
      return res.status(400).json({ error: 'Missing code or language' });

    if (!['python', 'javascript'].includes(language))
      return res.status(400).json({ error: 'Unsupported language. Use python or javascript.' });

    console.log(`[execute-code] ${language} (${code.length} chars)`);

    const sanitizedCode = validateAndSanitizeCode(code, language);
    const result        = await executeWithE2B(sanitizedCode, language, timeout);

    console.log(`[execute-code] ${result.success ? 'OK' : 'ERR'} ${result.executionTime}ms`);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('[execute-code] Error:', error);
    return res.status(500).json({
      error:         error.message || 'Internal server error',
      executionTime: 0,
      success:       false,
    });
  }
}