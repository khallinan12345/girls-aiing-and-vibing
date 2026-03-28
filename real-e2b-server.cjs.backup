// e2b-sdk-server.cjs - Using official E2B SDK
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// E2B Code Execution using official SDK
async function executeWithE2BSDK(code, language) {
  const startTime = Date.now();
  
  try {
    // Import E2B SDK dynamically
    const { Sandbox } = await import('@e2b/code-interpreter');
    
    const E2B_API_KEY = process.env.E2B_API_KEY;
    
    if (!E2B_API_KEY) {
      throw new Error('E2B_API_KEY not found in environment variables');
    }

    console.log(`🚀 Creating E2B ${language} sandbox using official SDK...`);

    // Create sandbox using official SDK
    const sandbox = await Sandbox.create({
      apiKey: E2B_API_KEY,
    });

    console.log(`✅ Created sandbox: ${sandbox.id}`);

    try {
      let result;
      
      if (language === 'python') {
        console.log('🐍 Executing Python code...');
        result = await sandbox.runCode(code);
      } else if (language === 'javascript') {
        console.log('🟨 Executing JavaScript code...');
        // For JavaScript, we need to create a file and run it
        await sandbox.filesystem.write('script.js', code);
        result = await sandbox.commands.run('node script.js');
      }

      // Close sandbox
      console.log('🧹 Closing sandbox...');
      await sandbox.close();

      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Total execution time: ${executionTime}ms`);

      if (result.error) {
        console.log('❌ Execution failed:', result.error);
        return {
          error: result.error,
          executionTime,
          success: false,
        };
      }

      const output = result.stdout || result.text || result.output || 'Code executed successfully (no output)';
      console.log('✅ Execution successful:', output.substring(0, 100) + '...');
      
      return {
        output: output,
        executionTime,
        success: true,
      };

    } catch (error) {
      // Close sandbox on error
      await sandbox.close().catch(() => {});
      throw error;
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('💥 E2B SDK execution error:', error.message);
    
    return {
      error: `E2B SDK execution failed: ${error.message}`,
      executionTime,
      success: false,
    };
  }
}

// Fallback: Use a simple JavaScript VM for testing
function executeJavaScriptLocally(code) {
  const startTime = Date.now();
  
  try {
    const vm = require('vm');
    
    let outputBuffer = [];
    
    const context = {
      console: {
        log: (...args) => {
          outputBuffer.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
      },
      setTimeout,
      clearTimeout,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
    };
    
    const vmContext = vm.createContext(context);
    const result = vm.runInContext(code, vmContext, {
      timeout: 30000,
      displayErrors: true,
    });

    const executionTime = Date.now() - startTime;
    
    let output = outputBuffer.join('\n');
    if (result !== undefined) {
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

// Code execution endpoint with fallback
app.post('/api/execute-code', async (req, res) => {
  const { code, language } = req.body;
  
  console.log(`\n🎵 E2B SDK Execution Request:`);
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
    
    // Try E2B SDK first
    try {
      result = await executeWithE2BSDK(code, language);
    } catch (sdkError) {
      console.warn('⚠️  E2B SDK failed, using fallback:', sdkError.message);
      
      if (language === 'javascript') {
        // Fallback to local JS execution
        result = executeJavaScriptLocally(code);
      } else {
        // For Python, return a helpful error
        result = {
          error: `E2B SDK failed (${sdkError.message}). Python execution requires E2B cloud sandbox.`,
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
    message: `E2B SDK server is running! API Key: ${hasApiKey ? 'Found' : 'Missing'}` 
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  const hasApiKey = !!process.env.E2B_API_KEY;
  
  console.log('\n🎵 E2B SDK Development Server Running!');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 E2B API Key: ${hasApiKey ? '✅ Found' : '❌ Missing'}`);
  console.log('🔗 Vite will proxy /api requests to this server');
  console.log('💡 This server uses the official E2B SDK with fallback!\n');
  
  if (!hasApiKey) {
    console.log('⚠️  WARNING: E2B_API_KEY not found!');
    console.log('   1. Get your API key from https://e2b.dev');
    console.log('   2. Add E2B_API_KEY=your_key_here to .env');
    console.log('   3. Restart this server\n');
  }
});
