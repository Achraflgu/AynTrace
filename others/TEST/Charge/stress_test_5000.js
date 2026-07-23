import http from 'http';

const TOTAL_DEVICES = 5000;
const BATCH_SIZE = 500; // Send 500 requests at a time
const API_URL = 'http://localhost:3001/api/track/token_poc_';
const DURATION_SECONDS = 30; // Test duration

let successCount = 0;
let errorCount = 0;
let latencies = [];

const agent = new http.Agent({ keepAlive: true, maxSockets: 1000 });

function sendTelemetry(index) {
    return new Promise((resolve) => {
        const token = `${index}`;
        const data = JSON.stringify({
            lat: 36.8065 + (Math.random() * 0.1 - 0.05),
            lng: 10.1815 + (Math.random() * 0.1 - 0.05),
            speed: Math.floor(Math.random() * 100),
            heading: Math.floor(Math.random() * 360),
            battery: Math.floor(Math.random() * 100),
        });

        const startTime = Date.now();
        const req = http.request(API_URL + token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
            agent: agent,
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const latency = Date.now() - startTime;
                if (res.statusCode === 200) {
                    successCount++;
                    latencies.push(latency);
                } else {
                    errorCount++;
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            errorCount++;
            resolve();
        });

        req.write(data);
        req.end();
    });
}

async function runBatch() {
    const promises = [];
    // Pick 500 random devices from the 5000 to update in this tick
    for (let i = 0; i < BATCH_SIZE; i++) {
        const deviceIndex = Math.floor(Math.random() * TOTAL_DEVICES) + 1;
        promises.push(sendTelemetry(deviceIndex));
    }
    await Promise.all(promises);
}

async function startStressTest() {
    console.log(`Starting Stress Test: 5000 Radios POC...`);
    console.log(`Targeting ${BATCH_SIZE} updates per cycle.\n`);

    const startTime = Date.now();
    let cycleCount = 0;

    const interval = setInterval(async () => {
        cycleCount++;
        const cycleStart = Date.now();
        await runBatch();
        const cycleTime = Date.now() - cycleStart;
        
        console.log(`[Cycle ${cycleCount}] Sent ${BATCH_SIZE} updates in ${cycleTime}ms. Success: ${successCount}, Errors: ${errorCount}`);

        if (Date.now() - startTime > DURATION_SECONDS * 1000) {
            clearInterval(interval);
            printResults(Date.now() - startTime);
        }
    }, 1000); // 1 cycle per second
}

function printResults(totalTimeMs) {
    const totalRequests = successCount + errorCount;
    const reqPerSec = (totalRequests / (totalTimeMs / 1000)).toFixed(2);
    
    // Calculate latency percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    console.log('\n==================================================');
    console.log('✅ STRESS TEST COMPLETED (5000 Radios POC)');
    console.log('==================================================');
    console.log(`Duration:         ${(totalTimeMs / 1000).toFixed(1)} s`);
    console.log(`Total Requests:   ${totalRequests}`);
    console.log(`Success Rate:     ${((successCount / totalRequests) * 100).toFixed(2)}% (${successCount} OK, ${errorCount} Errors)`);
    console.log(`Throughput:       ${reqPerSec} req/sec`);
    console.log('--------------------------------------------------');
    console.log('Latencies:');
    console.log(`  Median (p50):   ${p50} ms`);
    console.log(`  p95:            ${p95} ms`);
    console.log(`  p99:            ${p99} ms`);
    console.log('==================================================\n');
    process.exit(0);
}

startStressTest();
