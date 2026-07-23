import pg from 'pg';
const { Client } = pg;

async function testConnection() {
    // Try multiple common password combos
    const passwords = ['postgres', '123456', 'admin', 'password', ''];
    
    for (const password of passwords) {
        try {
            const client = new Client({
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: password,
                database: 'postgres', // default db
            });
            await client.connect();
            const res = await client.query('SELECT version()');
            console.log(`✅ Connected with password: "${password}"`);
            console.log(`   PostgreSQL: ${res.rows[0].version}`);
            
            // Check if PostGIS is available
            try {
                await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
                const gis = await client.query('SELECT PostGIS_Version()');
                console.log(`   PostGIS: ${gis.rows[0].postgis_version}`);
            } catch (e) {
                console.log(`   ⚠️ PostGIS not available: ${e.message}`);
            }
            
            await client.end();
            return password;
        } catch (e) {
            console.log(`❌ Password "${password}" failed: ${e.message.split('\n')[0]}`);
        }
    }
    
    console.log('\n💡 None of the default passwords worked.');
    console.log('   Please check your PostgreSQL password in pgAdmin or reinstall.');
    return null;
}

testConnection();
