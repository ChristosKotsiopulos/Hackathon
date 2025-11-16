/**
 * Hardcoded RedID to Email Mapping
 *
 * This dictionary maps RedIDs found via OCR to student email addresses.
 * Add entries here as you collect RedID/email pairs.
 */

const redIdEmailMap = {
    '132264610': 'ajasti7720@sdsu.edu',
    '132274230': 'ckotsiopulos5746@sdsu.edu',
    '131740957': 'ngaribi3916sdsu.edu',
    '132264610': 'ajasti7720@sdsu.edu',
};

/**
 * Get email address for a given RedID
 * @param {string} redId - Student RedID (9 digits)
 * @returns {string|null} Email address if found, null otherwise
 */
export function getEmailByRedId(redId) {
    if (!redId) {
        console.log('[RedID Map] ❌ No RedID provided');
        return null;
    }

    // Normalize RedID - match the normalization in cards.js (remove all whitespace)
    const normalizedRedId = String(redId).trim().replace(/\s+/g, '');

    console.log(`[RedID Map] 🔍 Looking up RedID: "${normalizedRedId}"`);
    console.log(`[RedID Map] Available keys:`, Object.keys(redIdEmailMap));
    console.log(`[RedID Map] Direct access test:`, redIdEmailMap[normalizedRedId]);

    const result = redIdEmailMap[normalizedRedId] || null;
    console.log(`[RedID Map] Result:`, result);

    return result;
}

/**
 * Add a new RedID to email mapping
 * @param {string} redId - Student RedID
 * @param {string} email - Student email address
 */
export function addRedIdMapping(redId, email) {
    if (redId && email) {
        redIdEmailMap[String(redId).trim()] = email.trim();
    }
}

/**
 * Get all current mappings (for debugging/admin)
 * @returns {Object} Copy of the mapping object
 */
export function getAllMappings() {
    return {...redIdEmailMap };
}

export default redIdEmailMap;
