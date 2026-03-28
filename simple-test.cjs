async function testDebugServer() {
  const response = await fetch('http://localhost:3001/api/execute-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'print("Hello from E2B!")',
      language: 'python'
    })
  });
  
  const result = await response.json();
  console.log('Result:', result);
}

testDebugServer().catch(console.error);
