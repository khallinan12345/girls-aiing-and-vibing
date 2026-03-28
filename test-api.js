// test-api.js - Updated version for testing Vite proxy
async function testAPI() {
    console.log('🧪 Testing API endpoint through Vite proxy...\n');
    
    const tests = [
      {
        name: 'Python print test',
        code: 'print("Hello from Python!")\nprint(2 + 2)',
        language: 'python'
      },
      {
        name: 'JavaScript console.log test', 
        code: 'console.log("Hello from JavaScript!")\nconsole.log(5 * 3)',
        language: 'javascript'
      },
      {
        name: 'Python math calculation',
        code: 'result = 10 * 5 + 3\nprint(f"Result: {result}")',
        language: 'python'
      },
      {
        name: 'Error simulation test',
        code: 'print(undefined_variable)',
        language: 'python'
      },
      {
        name: 'JavaScript math test',
        code: 'const result = Math.pow(2, 8)\nconsole.log(`2^8 = ${result}`)',
        language: 'javascript'
      }
    ];
  
    let passedTests = 0;
    let totalTests = tests.length;
  
    for (const test of tests) {
      console.log(`\n📝 Running: ${test.name}`);
      console.log(`Language: ${test.language}`);
      console.log(`Code: ${test.code}`);
      
      try {
        const startTime = Date.now();
        const response = await fetch('http://localhost:5173/api/execute-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: test.code,
            language: test.language
          }),
        });
  
        const fetchTime = Date.now() - startTime;
  
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
  
        const result = await response.json();
        
        console.log('✅ Response received:');
        console.log(`  Success: ${result.success}`);
        console.log(`  Execution Time: ${result.executionTime}ms`);
        console.log(`  Network Time: ${fetchTime}ms`);
        
        if (result.success) {
          console.log(`  Output: ${result.output}`);
          passedTests++;
        } else {
          console.log(`  Error: ${result.error}`);
          if (test.name.includes('Error simulation')) {
            // This test is supposed to fail, so count it as passed
            passedTests++;
            console.log('  ✅ Error test worked as expected!');
          }
        }
        
      } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // Additional debugging info
        if (error.message.includes('Unexpected token')) {
          console.log('  🔍 This looks like a proxy issue - you might be getting HTML instead of JSON');
          console.log('  💡 Try testing direct connection: change URL to http://localhost:3001/api/execute-code');
        } else if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          console.log('  🔍 Connection failed - check if servers are running');
        }
      }
    }
    
    console.log(`\n🎉 API testing complete!`);
    console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🌟 All tests passed! Your vibing code execution is ready! 🎵');
    } else {
      console.log('⚠️  Some tests failed. Check the output above for debugging info.');
    }
  }
  
  // Test health endpoint first
  async function testHealth() {
    console.log('🏥 Testing health endpoint...');
    
    try {
      const response = await fetch('http://localhost:5173/api/health');
      
      if (!response.ok) {
        throw new Error(`Health check HTTP error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('💚 Health Check passed:', result.message);
      console.log('✅ Vite proxy is working correctly!\n');
      return true;
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      console.log('\n🔍 Troubleshooting steps:');
      console.log('1. Make sure both servers are running:');
      console.log('   Terminal 1: node dev-server.cjs');
      console.log('   Terminal 2: npm run dev');
      console.log('2. Check that vite.config.ts includes the proxy configuration');
      console.log('3. Try restarting both servers');
      console.log('4. Test direct connection: node direct-api-test.js\n');
      
      // Test if the direct API is working
      console.log('🔧 Testing direct API connection...');
      try {
        const directResponse = await fetch('http://localhost:3001/api/health');
        const directResult = await directResponse.json();
        console.log('✅ Direct API is working:', directResult.message);
        console.log('❌ But Vite proxy is not working - check vite.config.ts');
      } catch (directError) {
        console.log('❌ Direct API also not working - Express server may not be running');
      }
      
      return false;
    }
  }
  
  // Enhanced status check
  async function checkServerStatus() {
    console.log('🔍 Checking server status...\n');
    
    // Check Express server
    try {
      const expressResponse = await fetch('http://localhost:3001/api/health');
      const expressResult = await expressResponse.json();
      console.log('✅ Express server (port 3001):', expressResult.message);
    } catch (error) {
      console.log('❌ Express server (port 3001): Not responding');
      console.log('   Fix: Run "node dev-server.cjs" in a terminal');
      return false;
    }
    
    // Check Vite server
    try {
      const viteResponse = await fetch('http://localhost:5173/');
      if (viteResponse.ok) {
        console.log('✅ Vite server (port 5173): Running');
      }
    } catch (error) {
      console.log('❌ Vite server (port 5173): Not responding');
      console.log('   Fix: Run "npm run dev" in a terminal');
      return false;
    }
    
    return true;
  }
  
  // Run tests
  async function runTests() {
    console.log('🚀 Starting comprehensive API tests...\n');
    
    const serversOk = await checkServerStatus();
    if (!serversOk) {
      console.log('\n❌ Server check failed. Please start the required servers first.');
      return;
    }
    
    console.log(''); // Empty line for readability
    
    const healthOk = await testHealth();
    if (healthOk) {
      await testAPI();
    } else {
      console.log('\n❌ Skipping API tests due to health check failure.');
    }
  }
  
  runTests();