// working-e2b-server.cjs - Using CURRENT E2B API (2024)
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Working E2B Code Execution using CURRENT API
async function executeWithCurrentE2B(code, language) {
  const startTime = Date.now();
  
  try {
    // Import E2B SDK
    const { Sandbox } = await import('@e2b/code-interpreter');
    
    const E2B_API_KEY = process.env.E2B_API_KEY;
    
    if (!E2B_API_KEY) {
      throw new Error('E2B_API_KEY not found in environment variables');
    }

    console.log(`🚀 Creating E2B ${language} sandbox using CURRENT API...`);

    // Create sandbox - current API reads from environment automatically
    const sandbox = await Sandbox.create();

    console.log(`✅ Created sandbox successfully`);

    try {
      let result;
      
      if (language === 'python') {
        console.log('🐍 Executing Python code...');
        // Use current API: sandbox.runCode() 
        result = await sandbox.runCode(code);
      } else if (language === 'javascript') {
        console.log('🟨 Executing JavaScript code...');
        // For JavaScript, create a simpler Python wrapper
        const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const wrappedCode = `
import subprocess
import tempfile
import os

# JavaScript code to execute
js_code = "${escapedCode}"

# Write to temporary file
with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
    f.write(js_code)
    js_file = f.name

try:
    # Try to run with node
    result = subprocess.run(['node', js_file], capture_output=True, text=True, timeout=30)
    if result.returncode == 0:
        print(result.stdout)
    else:
        print("JavaScript Error:", result.stderr)
except FileNotFoundError:
    print("Node.js not available - falling back to local execution")
except subprocess.TimeoutExpired:
    print("JavaScript execution timed out")
finally:
    # Clean up
    try:
        if os.path.exists(js_file):
            os.unlink(js_file)
    except:
        pass
`;
        result = await sandbox.runCode(wrappedCode);
      }

      // Note: Current E2B API might not have explicit close() method
      // The sandbox may auto-cleanup or use a different cleanup approach
      try {
        if (sandbox.close && typeof sandbox.close === 'function') {
          console.log('🧹 Closing sandbox...');
          await sandbox.close();
        } else {
          console.log('🧹 Sandbox will auto-cleanup...');
        }
      } catch (closeError) {
        console.log('ℹ️  Sandbox cleanup handled automatically');
      }

      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Total execution time: ${executionTime}ms`);

      // Handle current E2B result structure
      if (result && result.error) {
        console.log('❌ Execution failed:', result.error);
        return {
          error: result.error,
          executionTime,
          success: false,
        };
      }

      // Extract output from current E2B result structure
      let output = '';
      
      if (result) {
        // E2B stores output in result.logs.stdout array
        if (result.logs && result.logs.stdout && result.logs.stdout.length > 0) {
          output = result.logs.stdout.join('').trim();
        } else if (result.logs && result.logs.stderr && result.logs.stderr.length > 0) {
          // If no stdout, check stderr for error messages
          output = 'Error: ' + result.logs.stderr.join('').trim();
        } else if (result.results && result.results.length > 0) {
          // Check if there are any results
          output = result.results.map(r => r.text || r.output || r).join('\n');
        } else {
          output = 'Code executed successfully (no output)';
        }
      } else {
        output = 'Code executed successfully (no output)';
      }
      
      console.log('✅ Execution successful:', output.substring(0, 100) + (output.length > 100 ? '...' : ''));
      
      return {
        output: output,
        executionTime,
        success: true,
      };

    } catch (error) {
      // Try to close sandbox on error if possible
      try {
        if (sandbox && sandbox.close && typeof sandbox.close === 'function') {
          await sandbox.close();
        }
      } catch (closeError) {
        // Ignore close errors
      }
      throw error;
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('💥 E2B execution error:', error.message);
    
    return {
      error: `E2B execution failed: ${error.message}`,
      executionTime,
      success: false,
    };
  }
}

// Improved JavaScript fallback
function executeJavaScriptLocally(code) {
  const startTime = Date.now();
  
  try {
    const vm = require('vm');
    
    let outputBuffer = [];
    
    // Enhanced context with more JavaScript features
    const context = {
      console: {
        log: (...args) => {
          outputBuffer.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
        error: (...args) => {
          outputBuffer.push('ERROR: ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };
    
    const vmContext = vm.createContext(context);
    const result = vm.runInContext(code, vmContext, {
      timeout: 30000,
      displayErrors: true,
    });

    const executionTime = Date.now() - startTime;
    
    let output = outputBuffer.join('\n');
    if (result !== undefined && result !== null) {
      output += (output ? '\n' : '') + String(result);
    }

    return {
      output: output || 'Code executed successfully (no output)',
      executionTime,
      success: true,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    return {
      error: error.message,
      executionTime,
      success: false,
    };
  }
}

// Code execution endpoint
app.post('/api/execute-code', async (req, res) => {
  const { code, language } = req.body;
  
  console.log(`\n🎵 Working E2B API Execution Request:`);
  console.log(`📝 Language: ${language}`);
  console.log(`📝 Code: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);
  
  try {
    // Input validation
    if (!code || !language) {
      return res.status(400).json({ error: 'Missing code or language' });
    }

    if (!['python', 'javascript'].includes(language)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    if (code.length > 10000) {
      return res.status(400).json({ error: 'Code too long (max 10,000 characters)' });
    }

    let result;
    
    // Try current E2B API first
    try {
      result = await executeWithCurrentE2B(code, language);
    } catch (e2bError) {
      console.warn('⚠️  E2B failed, using fallback:', e2bError.message);
      
      if (language === 'javascript') {
        // Fallback to local JS execution
        result = executeJavaScriptLocally(code);
      } else {
        // For Python, return helpful error
        result = {
          error: `E2B failed (${e2bError.message}). Check your E2B account status.`,
          executionTime: 0,
          success: false,
        };
      }
    }
    
    console.log('📤 Sending result:', {
      success: result.success,
      outputLength: result.output ? result.output.length : 0,
      errorLength: result.error ? result.error.length : 0,
      executionTime: result.executionTime
    });
    
    res.json(result);

  } catch (error) {
    console.error('💥 API Error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      executionTime: 0,
      success: false,
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const hasApiKey = !!process.env.E2B_API_KEY;
  res.json({ 
    status: 'OK', 
    message: `Working E2B API server running! API Key: ${hasApiKey ? 'Found' : 'Missing'}` 
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  const hasApiKey = !!process.env.E2B_API_KEY;
  
  console.log('\n🎵 Working E2B API Development Server Running!');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 E2B API Key: ${hasApiKey ? '✅ Found' : '❌ Missing'}`);
  console.log('🔗 Vite will proxy /api requests to this server');
  console.log('💡 This server uses the CURRENT E2B API (2024)!\n');
  
  if (!hasApiKey) {
    console.log('⚠️  WARNING: E2B_API_KEY not found!');
    console.log('   1. Get your API key from https://e2b.dev');
    console.log('   2. Add E2B_API_KEY=your_key_here to .env');
    console.log('   3. Restart this server\n');
  } else {
    console.log('✅ Ready to execute code with E2B! Your billing is set up.');
  }
});