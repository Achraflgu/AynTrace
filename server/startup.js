// startup.js - Start tunnel, wait for URL, then start server
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

let tunnelUrl = null;

console.log('');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║         🚀 GeoTrack Server Starting...                ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');

// Start cloudflared tunnel (optional)
const CLOUDFLARED_BIN = process.env.CLOUDFLARED_PATH || 'cloudflared';
console.log(`[1/2] Starting Cloudflare Tunnel (${CLOUDFLARED_BIN})...`);

const tunnel = spawn(
    CLOUDFLARED_BIN,
    ['tunnel', '--url', 'http://127.0.0.1:3001'],
    {
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
    }
);

let fullOutput = '';

function parseUrl(text) {
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    return match ? match[0] : null;
}

function updateEnvAndStartServer(url) {
    if (tunnelUrl) return; // Already done
    tunnelUrl = url;

    // Update .env
    try {
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

        if (envContent.includes('TRACKER_URL=')) {
            envContent = envContent.replace(/TRACKER_URL=.*/g, `TRACKER_URL=${url}`);
        } else {
            envContent += `\nTRACKER_URL=${url}\n`;
        }

        fs.writeFileSync(envPath, envContent);
    } catch (err) {
        console.error('Error updating .env:', err.message);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📱 TRACKER URL:', `${url}/tracker/`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Start the server
    console.log('[2/2] Starting Express Server...');
    console.log('');

    const server = spawn('node', ['--watch', 'index.js'], {
        cwd: __dirname,
        stdio: 'inherit',
        shell: false
    });

    server.on('close', (code) => {
        console.log('[Server] Closed');
        tunnel.kill();
        process.exit(code);
    });
}

tunnel.stdout.on('data', (data) => {
    fullOutput += data.toString();
    if (!tunnelUrl) {
        const url = parseUrl(fullOutput);
        if (url) updateEnvAndStartServer(url);
    }
});

tunnel.stderr.on('data', (data) => {
    const text = data.toString();
    fullOutput += text;

    // Only show errors that are NOT DNS lookup timeouts (common during startup)
    if (text.toLowerCase().includes('error') && !text.includes('i/o timeout')) {
        console.log('[Tunnel]', text.trim());
    }

    if (!tunnelUrl) {
        const url = parseUrl(fullOutput);
        if (url) updateEnvAndStartServer(url);
    }
});

tunnel.on('close', (code) => {
    console.log('[Tunnel] Closed');
    process.exit(code);
});

tunnel.on('error', (err) => {
    console.error('[Tunnel] Error:', err.message);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    tunnel.kill();
    process.exit(0);
});

// Timeout fallback
setTimeout(() => {
    if (!tunnelUrl) {
        const url = parseUrl(fullOutput);
        if (url) {
            updateEnvAndStartServer(url);
        } else {
            console.error('❌ Could not get tunnel URL. Starting server anyway...');
            updateEnvAndStartServer('http://localhost:3001');
        }
    }
}, 15000);
