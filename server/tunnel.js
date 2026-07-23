// start-tunnel.js - Start cloudflared and auto-update TRACKER_URL (Clean output)
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

// console.log('\n🚀 Starting Cloudflare Tunnel...\n');

const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:3001'], {
    shell: false
});

let urlFound = false;
let fullOutput = '';

function parseUrl(text) {
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    return match ? match[0] : null;
}

function updateEnvFile(tunnelUrl) {
    try {
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        if (envContent.includes('TRACKER_URL=')) {
            envContent = envContent.replace(/TRACKER_URL=.*/g, `TRACKER_URL=${tunnelUrl}`);
        } else {
            envContent += `\nTRACKER_URL=${tunnelUrl}\n`;
        }

        fs.writeFileSync(envPath, envContent);

        console.log('✅ Tunnel ready!');
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📱 TRACKER URL:', `${tunnelUrl}/tracker/`);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
    } catch (err) {
        console.error('❌ Error updating .env:', err.message);
    }
}

// Handle stdout (minimal)
tunnel.stdout.on('data', (data) => {
    fullOutput += data.toString();

    if (!urlFound) {
        const url = parseUrl(fullOutput);
        if (url) {
            urlFound = true;
            updateEnvFile(url);
        }
    }
});

// Handle stderr - cloudflared logs here, filter for important messages only
tunnel.stderr.on('data', (data) => {
    const text = data.toString();
    fullOutput += text;

    // Only show errors that are NOT DNS lookup timeouts (common during startup)
    if ((text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) &&
        !text.includes('i/o timeout')) {
        console.log('[Tunnel]', text.trim());
    }

    if (!urlFound) {
        const url = parseUrl(fullOutput);
        if (url) {
            urlFound = true;
            updateEnvFile(url);
        }
    }
});

tunnel.on('close', (code) => {
    console.log(`\n🛑 Tunnel closed`);
});

tunnel.on('error', (err) => {
    console.error('❌ Tunnel error:', err.message);
});

process.on('SIGINT', () => {
    tunnel.kill();
    process.exit(0);
});

// Backup check
setTimeout(() => {
    if (!urlFound) {
        const url = parseUrl(fullOutput);
        if (url) {
            urlFound = true;
            updateEnvFile(url);
        }
    }
}, 10000);
