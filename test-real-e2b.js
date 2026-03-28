// test-real-e2b.js - Test real E2B execution
async function testRealE2B() {
  console.log('🧪 Testing REAL E2B code execution...\n');
  
  const tests = [
    {
      name: 'Simple Python calculation',
      code: 'result = 2 + 3\nprint(f"2 + 3 = {result}")',
      language: 'python'
    },
    {
      name: 'Python function test',
      code: 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("E2B"))',
      language: 'python'
    },
    {
      name: 'JavaScript calculation',
      code: 'const result = 5 * 7;\nconsole.log(`5 * 7 = ${result}`);',
      language: 'javascript'
    }
  ];

  for (const test of tests) {
    console.log(`\n📝 Running: ${test.name}`);
    console.log(`Code:\n${test.code}`);
    
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

      const networkTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      console.log('✅ Real E2B execution result:');
      console.log(`  Success: ${result.success}`);
      console.log(`  Execution Time: ${result.executionTime}ms`);
      console.log(`  Network Time: ${networkTime}ms`);
      
      if (result.success) {
        console.log(`  Output: ${result.output}`);
      } else {
        console.log(`  Error: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      
      if (error.message.includes('E2B_API_KEY')) {
        console.log('  💡 Make sure to add your E2B API key to .env.local');
      }
    }
  }
  
  console.log('\n🎉 Real E2B testing complete!');
}

testRealE2B();