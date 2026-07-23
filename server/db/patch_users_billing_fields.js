/**
 * patch_users_billing_fields.js
 * ─────────────────────────────────────────────────────────────────
 * One-time migration: aligns the existing `users` table with the
 * billing fields expected by the application.
 *
 * RUN ONCE:  node server/db/patch_users_billing_fields.js
 * ─────────────────────────────────────────────────────────────────
 */

import db from './knex.js';

const BILLING_COLUMNS = [
    { name: 'saved_payment_method', type: 'text', defaultTo: '' },
    { name: 'saved_billing_cycle', type: 'text', defaultTo: 'monthly' },
    { name: 'cancel_at_period_end', type: 'boolean', defaultTo: false },
    { name: 'pending_plan', type: 'text', defaultTo: null },
    { name: 'pending_billing_cycle', type: 'text', defaultTo: null },
    { name: 'billing_status', type: 'text', defaultTo: 'active' },
    { name: 'billing_next_due', type: 'timestamp', defaultTo: null },
    { name: 'billing_warned_at', type: 'timestamp', defaultTo: null },
];

async function patch() {
    console.log('🔧 Checking users table billing columns...');

    const existingColumns = await db.withSchema('information_schema').from('columns')
        .where({ table_name: 'users', table_schema: 'public' })
        .select('column_name');

    const existingColumnNames = new Set(existingColumns.map((column) => column.column_name));
    const missingColumns = BILLING_COLUMNS.filter((column) => !existingColumnNames.has(column.name));

    if (missingColumns.length === 0) {
        console.log('[--] Billing columns already exist on users table — nothing to do.');
        await db.destroy();
        return;
    }

    await db.schema.alterTable('users', (table) => {
        for (const column of missingColumns) {
            if (column.type === 'boolean') {
                const field = table.boolean(column.name);
                if (column.defaultTo !== null) field.defaultTo(column.defaultTo);
                continue;
            }

            if (column.type === 'timestamp') {
                const field = table.timestamp(column.name);
                if (column.defaultTo !== null) field.defaultTo(column.defaultTo);
                continue;
            }

            const field = table.text(column.name);
            if (column.defaultTo !== null) field.defaultTo(column.defaultTo);
        }
    });

    console.log(`[✅] Added ${missingColumns.map((column) => column.name).join(', ')} to users table.`);
    await db.destroy();
}

patch().catch((err) => {
    console.error('❌ Patch failed:', err.message);
    process.exit(1);
});