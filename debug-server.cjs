// simple-debug-server.cjs - Simplified debug server
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

console.log('🔍 Starting Simple Debug Server...');

// Simple debug function
async function simpleE2BDebug(code) {
  try {
    console.log(`📝 Executing: ${code}`);
    
    const { Sandbox } = await import('@e2b/code-interpreter');
    const sandbox = await Sandbox.create();
    
    console.log('✅ Sandbox created');
    
    const result = await sandbox.runCode(code);
    
    console.log('\n=== E2B RESULT DEBUG ===');
    console.log('Type:', typeof result);
    console.log('Constructor:', result.constructor.name);
    console.log('Keys:', Object.keys(result));
    
    // Log each property
    Object.entries(result).forEach(([key, value]) => {
      console.log(`${key}:`, value);
    });
    
    // Focus on logs
    if (result.logs) {
      console.log('\n--- LOGS DETAIL ---');
      console.log('stdout:', result.logs.stdout);
      console.log('stderr:', result.logs.stderr);
    }
    
    console.log('=== END DEBUG ===\n');
    
    return result;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Debug endpoint
app.post('/api/execute-code', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    console.log(`\n🎯 Request: ${language}`);
    console.log(`Code: ${code}`);
    
    if (language === 'python') {
      const result = await simpleE2BDebug(code);
      
      // Try to extract output
      let output = 'No output found';
      
      if (result.logs && result.logs.stdout && result.logs.stdout.length > 0) {
        output = result.logs.stdout.join('').trim();
        console.log(`✅ Found output: "${output}"`);
      } else {
        console.log('❌ No stdout found');
      }
      
      res.json({
        success: true,
        output: output,
        executionTime: 1000,
        debugInfo: {
          hasLogs: !!result.logs,
          stdoutCount: result.logs ? result.logs.stdout.length : 0
        }
      });
      
    } else {
      res.json({ output: 'Only Python debug for now', success: true });
    }
    
  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3001;

app.listen(PORT, (err) => {
  if (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
  
  console.log(`\n✅ Simple Debug Server Running on port ${PORT}`);
  console.log('🎯 Ready for testing!\n');
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});