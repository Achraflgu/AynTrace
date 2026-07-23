// Database connection using Knex.js
import Knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const db = Knex({
    client: 'pg',
    connection: process.env.DATABASE_URL || {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'geotrack',
    },
    pool: { min: 2, max: 10 },
    // Convert snake_case DB columns to camelCase in JS
    // We'll handle this manually in queries for clarity
});

export default db;
