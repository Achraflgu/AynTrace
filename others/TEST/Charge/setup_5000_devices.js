import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'geotrack',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
};

async function seed() {
    const client = new Client(dbConfig);
    await client.connect();
    
    console.log('Clearing existing POC devices...');
    await client.query("DELETE FROM devices WHERE name LIKE 'POC-Radio-%'");

    console.log('Inserting 5000 POC devices...');
    
    // Batch insert for performance
    const batchSize = 1000;
    const totalDevices = 5000;
    
    for (let i = 0; i < totalDevices; i += batchSize) {
        let values = [];
        let params = [];
        let paramIndex = 1;
        
        for (let j = 0; j < batchSize; j++) {
            const index = i + j + 1;
            const imei = `862000000${index.toString().padStart(6, '0')}`;
            const token = `token_poc_${index}`;
            const serial = `SN-POC-${index}`;
            
            // Generate basic values
            values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
            params.push(
                imei, 
                serial,
                `POC-Radio-${index}`, 
                'vehicle', 
                'real', 
                token, 
                'online', 
                36.8065 + (Math.random() * 0.1 - 0.05), // lat
                10.1815 + (Math.random() * 0.1 - 0.05), // lng
                new Date()
            );
        }
        
        const query = `
            INSERT INTO devices (imei, serial_number, name, device_type, data_source, tracking_token, status, location_lat, location_lng, last_update)
            VALUES ${values.join(', ')}
        `;
        
        await client.query(query, params);
        console.log(`Inserted ${i + batchSize}/${totalDevices} devices...`);
    }
    
    console.log('Successfully seeded 5000 POC devices!');
    await client.end();
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
