async function run() {
  const bridgeUrl = process.env.VITE_PI_BRIDGE_URL || 'http://127.0.0.1:8080';
  const bridgeToken = process.env.VITE_PI_BRIDGE_TOKEN || process.env.HOIMU_AUTH_TOKEN || 'hoimu_secret_token';
  
  console.log(`Starting Pi Bridge Smoke Test...`);
  console.log(`Target URL: ${bridgeUrl}`);
  
  const headers = {
    'Authorization': `Bearer ${bridgeToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    // 1. GET /health
    console.log(`\n[1/3] Testing GET /health ...`);
    const healthRes = await fetch(`${bridgeUrl}/api/v1/health`, { headers });
    if (!healthRes.ok) {
      throw new Error(`Health check failed: ${healthRes.status} ${healthRes.statusText}`);
    }
    const healthData = await healthRes.json();
    console.log('✅ Health check passed:');
    console.log(JSON.stringify(healthData, null, 2));

    // 2. GET /status
    console.log(`\n[2/3] Testing GET /status ...`);
    const statusRes = await fetch(`${bridgeUrl}/api/v1/status`, { headers });
    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${statusRes.status} ${statusRes.statusText}`);
    }
    const statusData = await statusRes.json();
    console.log('✅ Status check passed:');
    console.log(JSON.stringify(statusData, null, 2));

    // 3. POST /command (safe command like scan)
    console.log(`\n[3/3] Testing POST /command (scan) ...`);
    const cmdRes = await fetch(`${bridgeUrl}/api/v1/command`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ command: 'scan' })
    });
    if (!cmdRes.ok) {
      throw new Error(`Command check failed: ${cmdRes.status} ${cmdRes.statusText}`);
    }
    const cmdData = await cmdRes.json();
    console.log('✅ Command check passed:');
    console.log(JSON.stringify(cmdData, null, 2));

    console.log('\n🚀 Smoke test completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test failed:');
    console.error(error);
    process.exit(1);
  }
}

run();
