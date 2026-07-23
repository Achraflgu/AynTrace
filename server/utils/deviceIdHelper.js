import db from '../db/knex.js';

/**
 * Escape special regex characters in a string so it can be used as a literal in a regex.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the numeric part from a value by stripping the prefix (anchored to start).
 * Returns NaN if no valid number is found.
 */
function extractNumericPart(value, prefix) {
    if (!value || !prefix) return NaN;
    const regex = new RegExp('^' + escapeRegex(prefix), 'i');
    const numStr = value.replace(regex, '').trim();
    return parseInt(numStr, 10);
}

/**
 * Find the maximum numeric counter for a given field among enterprise devices.
 * Uses in-memory parsing to avoid SQL text-sorting bugs.
 */
async function findMaxCounter(enterpriseId, fieldName, prefix) {
    const devices = await db('devices')
        .where('enterprise_id', enterpriseId)
        .select(fieldName);

    let max = 0;
    for (const device of devices) {
        const val = device[fieldName];
        if (!val) continue;
        const num = extractNumericPart(val, prefix);
        if (!isNaN(num) && num > max) {
            max = num;
        }
    }
    return max;
}

/**
 * Get the enterprise's prefixes, falling back to defaults if enterprise not found.
 */
async function getEnterprisePrefixes(enterpriseId) {
    if (!enterpriseId) {
        return { serialPrefix: 'GT', imeiPrefix: '35907', subscriberPrefix: '500' };
    }

    const enterprise = await db('enterprises').where('id', enterpriseId).first();
    if (!enterprise) {
        return { serialPrefix: 'GT', imeiPrefix: '35907', subscriberPrefix: '500' };
    }

    return {
        serialPrefix: enterprise.serial_prefix || 'GT',
        imeiPrefix: enterprise.imei_prefix || '35907',
        subscriberPrefix: enterprise.subscriber_prefix || '500',
    };
}

/**
 * Subscriber numbers are always exactly 8 digits total.
 * The sequential counter is padded to fill the remaining digits after the prefix.
 * e.g. prefix "500" (3 chars) → counter padded to 5 → "500" + "00001" = "50000001" (8 chars)
 * e.g. prefix "5001" (4 chars) → counter padded to 4 → "5001" + "0001" = "50010001" (8 chars)
 *
 * Serial numbers are: prefix + 4-digit counter (e.g. "GT0001")
 * IMEI numbers are: prefix + 3-digit counter (e.g. "35907001")
 */
const SUBSCRIBER_TOTAL_LENGTH = 8;

/**
 * Generate next available device IDs (serial, imei, subscriber) for an enterprise.
 * Single source of truth — used by both the next-ids endpoint and device creation.
 *
 * @param {string} enterpriseId - The enterprise UUID
 * @returns {{ serialNumber: string, imei: string, subscriberNumber: string }}
 */
export async function getNextDeviceIds(enterpriseId) {
    const { serialPrefix, imeiPrefix, subscriberPrefix } = await getEnterprisePrefixes(enterpriseId);

    // Find max counters by scanning devices belonging to this enterprise
    const maxSerial = await findMaxCounter(enterpriseId, 'serial_number', serialPrefix);
    const maxImei = await findMaxCounter(enterpriseId, 'imei', imeiPrefix);
    const maxSubscriber = await findMaxCounter(enterpriseId, 'subscriber_number', subscriberPrefix);

    const nextSerial = maxSerial + 1;
    const nextImei = maxImei + 1;
    const nextSubscriber = maxSubscriber + 1;

    // Subscriber counter fills remaining digits so total = SUBSCRIBER_TOTAL_LENGTH (8)
    const subscriberCounterLen = Math.max(1, SUBSCRIBER_TOTAL_LENGTH - subscriberPrefix.length);

    return {
        serialNumber: `${serialPrefix}${nextSerial.toString().padStart(4, '0')}`,
        imei: `${imeiPrefix}${nextImei.toString().padStart(3, '0')}`,
        subscriberNumber: `${subscriberPrefix}${nextSubscriber.toString().padStart(subscriberCounterLen, '0')}`,
    };
}

/**
 * Validate that IMEI, serial number, and subscriber number are unique.
 * Also enforces that subscriber number is exactly 8 digits.
 * Throws an error with a descriptive message if any rule is violated.
 *
 * @param {{ imei?: string, serialNumber?: string, subscriberNumber?: string }} data
 * @param {string|null} excludeDeviceId - Device ID to exclude (for updates)
 */
export async function validateDeviceUniqueness(data, excludeDeviceId = null) {
    const errors = [];

    // Validate subscriber number format: must be exactly 8 digits
    if (data.subscriberNumber) {
        if (!/^\d{8}$/.test(data.subscriberNumber)) {
            errors.push(`Le N° Abonné/SIM doit contenir exactement 8 chiffres (reçu: "${data.subscriberNumber}").`);
        }
    }

    if (data.imei) {
        let query = db('devices').where('imei', data.imei);
        if (excludeDeviceId) query = query.whereNot('id', excludeDeviceId);
        const existing = await query.first();
        if (existing) {
            errors.push(`L'IMEI "${data.imei}" est déjà utilisé par l'appareil "${existing.name}".`);
        }
    }

    if (data.serialNumber) {
        let query = db('devices').where('serial_number', data.serialNumber);
        if (excludeDeviceId) query = query.whereNot('id', excludeDeviceId);
        const existing = await query.first();
        if (existing) {
            errors.push(`Le N° Série "${data.serialNumber}" est déjà utilisé par l'appareil "${existing.name}".`);
        }
    }

    if (data.subscriberNumber && /^\d{8}$/.test(data.subscriberNumber)) {
        let query = db('devices').where('subscriber_number', data.subscriberNumber);
        if (excludeDeviceId) query = query.whereNot('id', excludeDeviceId);
        const existing = await query.first();
        if (existing) {
            errors.push(`Le N° Abonné "${data.subscriberNumber}" est déjà utilisé par l'appareil "${existing.name}".`);
        }
    }

    if (errors.length > 0) {
        const err = new Error(errors.join(' '));
        err.statusCode = 400;
        throw err;
    }
}
