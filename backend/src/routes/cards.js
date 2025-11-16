/**
 * Cards API Routes
 *
 * NOTE: This version avoids optional chaining (?.) completely
 * so formatters / Live Share can't break it into "? ."
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
    createCard,
    findCardById,
    findCardByPickupCode,
    findCardByReferenceCode,
    updateCard,
    getAllCards
} from '../store/cardsStore.js';
import { extractInfoFromImage } from '../services/ocrService.js';
import { notifyOwnerOfFoundCard } from '../services/notificationService.js';
import { getEmailByRedId, getAllMappings } from '../services/redIdEmailMap.js';

const router = express.Router();

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate a pickup code using only digits 1, 2, 3, 4
 * @param {number} length - Length of the code (default: 4)
 * @returns {string} Pickup code
 */
function generatePickupCode(length = 4) {
    const allowedDigits = ['1', '2', '3', '4'];
    let code = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * allowedDigits.length);
        code += allowedDigits[randomIndex];
    }
    return code;
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'card-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

/**
 * POST /api/found-card-photo
 * Used by React app (and future mobile app) when someone uploads a photo
 * Automatically processes image with OCR, finds owner, and sends email
 */
router.post('/found-card-photo', upload.single('cardImage'), async(req, res) => {
    try {
        const { finderContact, locationDescription, boxId, manualRedId } = req.body;
        const imagePath = req.file ? req.file.path : null;

        console.log('[Route] Received form data:', {
            finderContact,
            locationDescription,
            boxId,
            manualRedId,
            hasImage: !!imagePath
        });

        if (!imagePath) {
            console.error('[Route] ❌ No image file in request');
            return res.status(400).json({ error: 'No image file provided' });
        }

        if (!fs.existsSync(imagePath)) {
            console.error(`[Route] ❌ Uploaded file not found: ${imagePath}`);
            return res.status(400).json({ error: 'Uploaded file not found on server' });
        }

        // Generate a pickup code if box is assigned (using only digits 1, 2, 3, 4)
        const pickupCode = boxId ? generatePickupCode(4) : null;

        // Create card record first
        const card = createCard({
            source: 'web',
            finderContact: finderContact || null,
            locationDescription: locationDescription || null,
            boxId: boxId || null,
            pickupCode: pickupCode,
            status: 'waiting_for_email'
        });

        let extractedInfo = null;
        let emailSentStatus = false;
        let emailAddress = null;
        let redIdToUse = null;

        console.log('[Route] 📋 Initial state:', {
            emailSentStatus,
            emailAddress,
            emailSentStatusType: typeof emailSentStatus,
            emailAddressType: typeof emailAddress
        });

        // OCR step
        try {
            extractedInfo = await extractInfoFromImage(imagePath);
            console.log('[Route] Extracted info from image:', extractedInfo);
        } catch (ocrError) {
            console.error('[Route] Error during OCR:', ocrError);
            // Continue even if OCR fails - we might have manual RedID
        }

        // ---- REDID & NAME SELECTION (NO OPTIONAL CHAINING) ----
        const trimmedManualRedId =
            typeof manualRedId === 'string' ? manualRedId.trim() : null;

        const extractedRedId =
            extractedInfo && extractedInfo.redId ? String(extractedInfo.redId) : null;

        redIdToUse = trimmedManualRedId || extractedRedId;

        const extractedFullName =
            extractedInfo && extractedInfo.fullName ? extractedInfo.fullName : null;

        console.log('[Route] RedID to use:', {
            manualRedId: trimmedManualRedId,
            extractedRedId,
            finalRedId: redIdToUse,
            redIdType: typeof redIdToUse,
            redIdLength: redIdToUse ? String(redIdToUse).length : 0
        });

        // Update card with extracted info
        if (redIdToUse || extractedFullName) {
            updateCard(card.id, {
                redId: redIdToUse || null,
                fullName: extractedFullName || null
            });
        }

        // ---- EMAIL LOOKUP ----
        let owner = null;

        if (redIdToUse) {
            const normalizedRedId = String(redIdToUse)
                .trim()
                .replace(/\s+/g, '');
            console.log(
                `[Route] 🔍 Looking up email for RedID: "${normalizedRedId}" (original: "${redIdToUse}", type: ${typeof redIdToUse}, length: ${normalizedRedId.length})`
            );

            const email = getEmailByRedId(normalizedRedId);
            console.log(`[Route] getEmailByRedId("${normalizedRedId}") returned: ${email}`);

            if (email) {
                console.log(
                    `[Route] ✅ Found email for RedID ${normalizedRedId}: ${email}`
                );
                owner = {
                    email: email,
                    fullName: extractedFullName || null,
                    redId: normalizedRedId
                };
            } else {
                console.log(
                    `[Route] ❌ No email found for RedID "${normalizedRedId}"`
                );
                const allMappings = getAllMappings();
                console.log(
                    '[Route] Available RedID keys in map:',
                    Object.keys(allMappings)
                );
                console.log(
                    `[Route] Checking if "${normalizedRedId}" === "132264610":`,
                    normalizedRedId === '132264610'
                );
                console.log(
                    `[Route] Checking if "${normalizedRedId}" == "132264610":`,
                    normalizedRedId == '132264610'
                );
                console.log(
                    '[Route] RedID value inspection:',
                    JSON.stringify(normalizedRedId)
                );
                console.log(
                    '[Route] RedID char codes:',
                    normalizedRedId.split('').map((c) => c.charCodeAt(0))
                );
                console.log(
                    '[Route] Direct map access test:',
                    allMappings[normalizedRedId]
                );
            }
        } else {
            console.log(`[Route] ⚠️ redIdToUse is falsy: ${redIdToUse}`);
        }

        // ---- EMAIL NOTIFICATION ----
        if (owner && owner.email) {
            try {
                const currentCard = findCardById(card.id);
                console.log('[Route] Sending email with card data:', {
                    cardId: currentCard.id,
                    boxId: currentCard.boxId,
                    pickupCode: currentCard.pickupCode,
                    locationDescription: currentCard.locationDescription,
                    finderContact: currentCard.finderContact
                });

                emailAddress = owner.email;
                console.log(`[Route] Attempting to send email to: ${emailAddress}`);

                const emailSent = await notifyOwnerOfFoundCard(owner, currentCard);
                console.log('[Route] SendGrid returned:', emailSent);

                if (emailSent) {
                    updateCard(card.id, {
                        status: 'email_sent',
                        email: owner.email,
                        fullName: owner.fullName || extractedFullName || null
                    });
                    emailSentStatus = true;
                    console.log(
                        `[Route] ✅ Email sent successfully to ${owner.email} for RedID ${redIdToUse}`
                    );
                } else {
                    updateCard(card.id, {
                        email: owner.email,
                        fullName: owner.fullName || extractedFullName || null
                    });
                    console.log(
                        `[Route] ❌ Email failed to send, but owner info saved for RedID ${redIdToUse}`
                    );
                    console.log(
                        `[Route] Email address found: ${emailAddress}, but SendGrid returned false`
                    );
                }
            } catch (emailError) {
                console.error(
                    '[Route] ❌ Error sending email notification:',
                    emailError
                );
                console.error('[Route] Error stack:', emailError.stack);

                if (owner && owner.email) {
                    updateCard(card.id, {
                        email: owner.email,
                        fullName: owner.fullName || extractedFullName || null
                    });
                }
                console.log(
                    `[Route] Email address was: ${emailAddress}, but exception occurred`
                );
            }
        } else {
            console.log(
                '[Route] ⚠️ No owner found - email lookup failed or owner.email is missing'
            );
            console.log(`[Route] redIdToUse: "${redIdToUse}"`);
            console.log('[Route] owner:', owner);
            console.log(
                '[Route] owner email:',
                owner && Object.prototype.hasOwnProperty.call(owner, 'email') ?
                owner.email :
                null
            );
            console.log(
                `[Route] emailAddress is: ${emailAddress}, emailSentStatus is: ${emailSentStatus}`
            );
            emailAddress = null;
            emailSentStatus = false;
            console.log(
                `[Route] After setting defaults - emailAddress: ${emailAddress}, emailSentStatus: ${emailSentStatus}`
            );
        }

        // ---- FINAL CARD + RESPONSE ----
        const finalCard = findCardById(card.id);
        const referenceCode = card.id.substring(0, 8).toUpperCase();

        let message = 'Thanks! Your report has been recorded.';
        const redIdForMessage = redIdToUse || finalCard.redId;

        if (
            extractedInfo &&
            (extractedInfo.redId || extractedInfo.fullName)
        ) {
            message = 'Thanks! We extracted information from the card.';
        }

        if (redIdForMessage) {
            message += ' Your RedID is ' + redIdForMessage + '.';
        }

        if (finalCard.boxId && finalCard.pickupCode) {
            message +=
                ' The card is stored at ' +
                finalCard.boxId +
                '. Pickup code: ' +
                finalCard.pickupCode +
                '.';
        }

        message += ' Your reference ID is ' + referenceCode + '.';

        console.log('[Route] 📤 Final response data:', {
            emailSent: emailSentStatus,
            emailAddress,
            redId: redIdForMessage || finalCard.redId,
            redIdToUse,
            finalCardRedId: finalCard.redId,
            boxId: finalCard.boxId,
            pickupCode: finalCard.pickupCode
        });

        const emailSentValue = emailSentStatus === true;
        const emailAddressValue = emailAddress || null;

        console.log('[Route] 📋 Before building response:', {
            emailSentStatus,
            emailSentValue,
            emailAddress,
            emailAddressValue,
            redIdToUse,
            owner,
            ownerEmail: owner && owner.email,
            hasOwner: !!owner,
            hasOwnerEmail: !!(owner && owner.email)
        });

        const responseData = {
            cardId: finalCard.id,
            referenceCode: referenceCode,
            message: message,
            boxId: finalCard.boxId || null,
            pickupCode: finalCard.pickupCode || null,
            redId: redIdForMessage || finalCard.redId || null,
            extractedInfo: extractedInfo || null,
            emailSent: emailSentValue,
            emailAddress: emailAddressValue
        };

        if (responseData.emailSent === undefined) {
            console.warn('[Route] ⚠️ emailSent was undefined, setting to false');
            responseData.emailSent = false;
        }
        if (responseData.emailAddress === undefined) {
            console.warn('[Route] ⚠️ emailAddress was undefined, setting to null');
            responseData.emailAddress = null;
        }

        console.log('[Route] 📤 Sending response:', JSON.stringify(responseData, null, 2));
        return res.json(responseData);
    } catch (error) {
        console.error('[Route] ❌ Error processing found card photo:', error);
        console.error('[Route] Error stack:', error.stack);
        console.error('[Route] Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });

        let errorMessage = 'Failed to process card photo';
        if (error.message) {
            errorMessage += ': ' + error.message;
        }

        return res.status(500).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ?
                error.message : undefined
        });
    }
});

/**
 * POST /api/found-card-redid
 * Used by Arduino box (and for manual testing) when a card is scanned
 */
router.post('/found-card-redid', async(req, res) => {
    try {
        const { redId, boxId } = req.body;

        if (!redId || !boxId) {
            return res.status(400).json({ error: 'redId and boxId are required' });
        }

        const pickupCode = generatePickupCode(4);

        const card = createCard({
            redId,
            source: 'box',
            boxId,
            pickupCode,
            status: 'waiting_for_email'
        });

        let owner = null;
        const email = getEmailByRedId(redId);
        if (email) {
            console.log(`[Route] Found email for RedID ${redId}: ${email}`);
            owner = {
                email: email,
                fullName: null,
                redId: redId
            };
        } else {
            console.log(`[Route] No email mapping found for RedID ${redId}`);
        }

        if (owner && owner.email) {
            try {
                const emailSent = await notifyOwnerOfFoundCard(owner, card);
                if (emailSent) {
                    updateCard(card.id, {
                        status: 'email_sent',
                        email: owner.email,
                        fullName: owner.fullName || null
                    });
                    console.log(
                        `[Route] Email sent to ${owner.email} for RedID ${redId} with pickupCode ${pickupCode}`
                    );
                } else {
                    updateCard(card.id, {
                        email: owner.email,
                        fullName: owner.fullName || null
                    });
                    console.log(
                        `[Route] Email failed to send, but owner info saved for RedID ${redId}`
                    );
                }
            } catch (emailError) {
                console.error(
                    '[Route] Error sending email notification:',
                    emailError
                );
                if (owner.email) {
                    updateCard(card.id, {
                        email: owner.email,
                        fullName: owner.fullName || null
                    });
                }
            }
        } else {
            console.log(
                `[Route] No email found for RedID ${redId}, card status: waiting_for_email`
            );
        }

        return res.json({
            cardId: card.id,
            pickupCode
        });
    } catch (error) {
        console.error('Error processing found card by RedID:', error);
        return res.status(500).json({ error: 'Failed to process card' });
    }
});

/**
 * POST /api/pickup-request
 * Used by box and app when someone wants to claim the card
 */
router.post('/pickup-request', async(req, res) => {
    try {
        const { pickupCode, boxId } = req.body;

        if (!pickupCode || !boxId) {
            return res.status(400).json({ error: 'pickupCode and boxId are required' });
        }

        const card = findCardByPickupCode(pickupCode, boxId);

        if (!card) {
            return res.json({ ok: false, reason: 'invalid_code' });
        }

        if (card.status === 'picked_up') {
            return res.json({ ok: false, reason: 'already_picked_up' });
        }

        updateCard(card.id, {
            status: 'picked_up',
            pickedUpAt: new Date()
        });

        return res.json({
            ok: true,
            message: 'Card has been taken out successfully',
            cardId: card.id
        });
    } catch (error) {
        console.error('Error processing pickup request:', error);
        return res.status(500).json({ error: 'Failed to process pickup request' });
    }
});

/**
 * GET /api/cards/:id
 * Get card details by ID or reference code (for debugging and web app status page)
 */
router.get('/cards/:id', (req, res) => {
    try {
        const { id } = req.params;

        let card = findCardById(id);

        // If not found and ID is 8 characters, try reference code lookup
        if (!card && id.length === 8) {
            card = findCardByReferenceCode(id);
        }

        // If still not found, try again (case-insensitive or alt implementation)
        if (!card) {
            card = findCardByReferenceCode(id);
        }

        if (!card) {
            return res
                .status(404)
                .json({ error: 'Card not found. Please check your reference code.' });
        }

        return res.json(card);
    } catch (error) {
        console.error('Error fetching card:', error);
        return res.status(500).json({ error: 'Failed to fetch card' });
    }
});

/**
 * GET /api/cards
 * Get all cards (for admin - supports filtering by status)
 * Query params: ?status=waiting_for_email
 */
router.get('/cards', (req, res) => {
    try {
        const { status } = req.query;
        const filters = status ? { status } : {};
        const cards = getAllCards(filters);
        return res.json(cards);
    } catch (error) {
        console.error('Error fetching cards:', error);
        return res.status(500).json({ error: 'Failed to fetch cards' });
    }
});

/**
 * POST /api/cards/:id/set-email
 * Admin endpoint: Manually set email address and send notification
 */
router.post('/cards/:id/set-email', async(req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email || email.indexOf('@') === -1) {
            return res.status(400).json({ error: 'Valid email address is required' });
        }

        const card = findCardById(id);

        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }

        if (card.status !== 'waiting_for_email') {
            return res.status(400).json({
                error: 'Card is not waiting for email. Current status: ' + card.status
            });
        }

        let pickupCode = card.pickupCode;
        if (card.boxId && !pickupCode) {
            pickupCode = generatePickupCode(4);
            updateCard(card.id, { pickupCode });
        }

        updateCard(card.id, { email });

        const updatedCard = findCardById(id);

        const owner = {
            email: email,
            fullName: updatedCard.fullName || 'Student'
        };

        console.log('[Admin] Sending email to ' + email + ' for card ' + id);
        const emailSent = await notifyOwnerOfFoundCard(owner, updatedCard);

        if (emailSent) {
            updateCard(card.id, {
                status: 'email_sent'
            });

            return res.json({
                success: true,
                message: 'Email sent successfully',
                card: findCardById(id)
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Email address saved but failed to send email. Check SendGrid configuration.',
                card: findCardById(id),
                sendGridConfigured: !!process.env.SENDGRID_API_KEY
            });
        }
    } catch (error) {
        console.error('Error setting email and sending notification:', error);
        return res.status(500).json({
            error: 'Failed to set email and send notification',
            message: error.message
        });
    }
});

/**
 * POST /api/test-sendgrid
 * Test endpoint to verify SendGrid email functionality
 */
router.post('/test-sendgrid', async(req, res) => {
    try {
        const { toEmail, testName } = req.body;

        if (!toEmail) {
            return res
                .status(400)
                .json({ error: 'Please provide toEmail in request body' });
        }

        const testOwner = {
            email: toEmail,
            fullName: testName || 'Test User'
        };

        const testCard = {
            id: 'test-' + Date.now(),
            boxId: 'BOX_1',
            pickupCode: '123456',
            locationDescription: 'Test Location - SendGrid Test',
            finderContact: null,
            status: 'notified_owner'
        };

        console.log('[Test] Attempting to send test email to:', toEmail);
        const emailSent = await notifyOwnerOfFoundCard(testOwner, testCard);

        if (emailSent) {
            return res.json({
                success: true,
                message: 'Test email sent successfully!',
                recipient: toEmail,
                card: testCard
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to send test email. Check server logs and SendGrid configuration.',
                recipient: toEmail,
                sendGridConfigured: !!process.env.SENDGRID_API_KEY
            });
        }
    } catch (error) {
        console.error('[Test] Error testing SendGrid:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to test SendGrid',
            message: error.message,
            sendGridConfigured: !!process.env.SENDGRID_API_KEY
        });
    }
});

export default router;
