/**
 * In-memory store for lost/found student ID cards
 * Later this will be replaced with a real database (Prisma + Postgres or Supabase)
 */

const cardsStore = [];

/**
 * Card status types:
 * - waiting_for_email: Card found, waiting for admin to manually look up and set email
 * - email_sent: Owner has been notified via email
 * - picked_up: Card has been retrieved by owner
 */

/**
 * Create a new card record
 * @param {Object} cardData - Card data
 * @returns {Object} Created card object
 */
export function createCard(cardData) {
    const card = {
        id: crypto.randomUUID(),
        redId: cardData.redId || null,
        fullName: cardData.fullName || null,
        email: cardData.email || null, // Email address (set manually by admin)
        source: cardData.source || 'web', // 'web' or 'box'
        finderContact: cardData.finderContact || null,
        locationDescription: cardData.locationDescription || null,
        boxId: cardData.boxId || null,
        pickupCode: cardData.pickupCode || null,
        status: cardData.status || 'waiting_for_email',
        createdAt: new Date(),
        openRequestedAt: null, // Timestamp when web app requests box to open
        ...cardData
    };

    cardsStore.push(card);
    return card;
}

/**
 * Find a card by ID
 * @param {string} cardId - Card ID
 * @returns {Object|null} Card object or null
 */
export function findCardById(cardId) {
    return cardsStore.find(card => card.id === cardId) || null;
}

/**
 * Find a card by reference code (first 8 characters of card ID, case-insensitive)
 * @param {string} referenceCode - Reference code (e.g., "A33CDB0D")
 * @returns {Object|null} Card object or null
 */
export function findCardByReferenceCode(referenceCode) {
    if (!referenceCode) return null;
    const normalizedCode = referenceCode.trim().toUpperCase();
    return cardsStore.find(card => {
        const cardRefCode = card.id.substring(0, 8).toUpperCase();
        return cardRefCode === normalizedCode;
    }) || null;
}

/**
 * Find a card by pickup code and box ID
 * @param {string} pickupCode - Pickup code
 * @param {string} boxId - Box ID
 * @returns {Object|null} Card object or null
 */
export function findCardByPickupCode(pickupCode, boxId) {
    return cardsStore.find(
        card => card.pickupCode === pickupCode && card.boxId === boxId
    ) || null;
}

/**
 * Update a card
 * @param {string} cardId - Card ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated card or null if not found
 */
export function updateCard(cardId, updates) {
    const card = findCardById(cardId);
    if (!card) return null;

    Object.assign(card, updates);
    return card;
}

/**
 * Get all cards (for debugging/admin)
 * @param {Object} filters - Optional filters (e.g., { status: 'waiting_for_email' })
 * @returns {Array} All cards matching filters
 */
export function getAllCards(filters = {}) {
    let cards = [...cardsStore];

    // Apply filters
    if (filters.status) {
        cards = cards.filter(card => card.status === filters.status);
    }

    // Sort by creation date (newest first)
    cards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return cards;
}