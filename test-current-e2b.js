// test-current-e2b.js - Test the working E2B server
async function testCurrentE2B() {
  console.log('🧪 Testing WORKING E2B API...\n');

  const tests = [
    {
      name: 'Simple Python calculation',
      code: 'result = 2 + 3\nprint(f"2 + 3 = {result}")',
      language: 'python'
    },
    {
      name: 'Python with variables',
      code: 'name = "E2B"\nprint(f"Hello, {name}!")\nprint("Current API is working!")',
      language: 'python'
    },
    {
      name: 'JavaScript calculation',
      code: 'const result = 5 * 7;\nconsole.log(`5 * 7 = ${result}`);',
      language: 'javascript'
    }
  ];

  for (const test of tests) {
    console.log(`📝 Running: ${test.name}`);
    console.log(`Code:\n${test.code}\n`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:3001/api/execute-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: test.code,
          language: test.language
        })
      });

      const networkTime = Date.now() - startTime;
      const result = await response.json();
      
      console.log('✅ Working E2B execution result:');
      console.log(`  Success: ${result.success}`);
      console.log(`  Execution Time: ${result.executionTime}ms`);
      console.log(`  Network Time: ${networkTime}ms`);
      
      if (result.success) {
        console.log(`  Output: ${result.output}`);
      } else {
        console.log(`  Error: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('🎉 Current E2B API testing complete!');
}

testCurrentE2B().catch(console.error);