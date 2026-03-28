// debug-e2b-output.cjs - Debug what E2B actually returns (CommonJS)
require('dotenv').config();

async function debugE2BOutput() {
  console.log('🔍 Debugging E2B Output Structure...\n');

  try {
    // Import E2B SDK
    const { Sandbox } = await import('@e2b/code-interpreter');
    
    console.log('📡 Creating E2B sandbox...');
    const sandbox = await Sandbox.create();
    console.log('✅ Sandbox created successfully\n');

    // Test simple Python code
    const testCode = 'result = 2 + 3\nprint(f"2 + 3 = {result}")';
    console.log(`🐍 Executing Python code:\n${testCode}\n`);
    
    const result = await sandbox.runCode(testCode);
    
    // Log the FULL result structure
    console.log('📋 FULL E2B Result Structure:');
    console.log('=====================================');
    console.log('Raw result:', result);
    console.log('=====================================');
    console.log('Result type:', typeof result);
    console.log('Result keys:', result ? Object.keys(result) : 'null');
    console.log('=====================================');
    
    // Check all possible properties
    const possibleProps = [
      'text', 'output', 'stdout', 'stderr', 'results', 'data', 
      'content', 'value', 'response', 'body', 'logs', 'execution'
    ];
    
    console.log('🔍 Checking possible output properties:');
    for (const prop of possibleProps) {
      if (result && result[prop] !== undefined) {
        console.log(`✅ ${prop}:`, result[prop]);
      } else {
        console.log(`❌ ${prop}: undefined`);
      }
    }
    
    // If result has nested objects, explore them
    if (result && typeof result === 'object') {
      console.log('\n🔎 Exploring nested properties:');
      for (const [key, value] of Object.entries(result)) {
        console.log(`${key}:`, typeof value, value);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          console.log(`  ${key} keys:`, Object.keys(value));
        }
      }
    }
    
    // Test if result is an array
    if (Array.isArray(result)) {
      console.log('\n📜 Result is an array with', result.length, 'items');
      result.forEach((item, index) => {
        console.log(`Item ${index}:`, item);
      });
    }
    
    // Try to close sandbox
    try {
      if (sandbox.close && typeof sandbox.close === 'function') {
        await sandbox.close();
        console.log('\n🧹 Sandbox closed successfully');
      } else {
        console.log('\n🧹 No close method found (auto-cleanup)');
      }
    } catch (closeError) {
      console.log('\n🧹 Sandbox cleanup handled automatically');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Full error:', error);
  }
  
  console.log('\n🏁 Debug complete!');
}

debugE2BOutput().catch(console.error);