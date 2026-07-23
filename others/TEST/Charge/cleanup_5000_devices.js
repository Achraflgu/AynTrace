import { Client } from 'pg';

const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'geotrack',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
};

async function cleanup() {
    const client = new Client(dbConfig);
    await client.connect();
    
    console.log('Searching for POC devices...');
    const res = await client.query("SELECT COUNT(*) FROM devices WHERE name LIKE 'POC-Radio-%'");
    const count = res.rows[0].count;
    console.log(`Found ${count} POC devices.`);

    if (count > 0) {
        console.log('Removing POC devices...');
        await client.query("DELETE FROM devices WHERE name LIKE 'POC-Radio-%'");
        console.log('Successfully removed POC devices.');
    } else {
        console.log('No POC devices found to remove.');
    }

    await client.end();
}

cleanup().catch(err => {
    console.error('Cleanup error:', err);
    process.exit(1);
});
