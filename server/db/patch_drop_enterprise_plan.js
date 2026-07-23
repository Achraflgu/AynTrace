/**
 * patch_drop_enterprise_plan.js
 * ─────────────────────────────────────────────────────────────────
 * One-time migration: drops the unused `plan` column from the
 * `enterprises` table.
 *
 * WHY: Plan-based access control is exclusively governed by
 *      `users.plan`. The `enterprises.plan` field was never read
 *      by any route or frontend component for access decisions.
 *
 * RUN ONCE:  node server/db/patch_drop_enterprise_plan.js
 * ─────────────────────────────────────────────────────────────────
 */

import db from './knex.js';

async function patch() {
    console.log('🔧 Checking enterprises table for "plan" column...');

    const hasColumn = await db.schema.hasColumn('enterprises', 'plan');

    if (!hasColumn) {
        console.log('[--] Column "plan" does not exist on enterprises — nothing to do.');
        await db.destroy();
        return;
    }

    await db.schema.alterTable('enterprises', (t) => {
        t.dropColumn('plan');
    });

    console.log('[✅] Column "plan" dropped from enterprises table.');
    console.log('');
    console.log('Access control truth: user.plan is the single source of truth.');
    await db.destroy();
}

patch().catch(err => {
    console.error('❌ Patch failed:', err.message);
    process.exit(1);
});
