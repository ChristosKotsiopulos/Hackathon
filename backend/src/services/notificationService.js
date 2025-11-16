/**
 * Notification Service - Sends emails to card owners using SendGrid
 */

import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables (in case they're not loaded yet)
dotenv.config();

// Initialize SendGrid if API key is provided
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (sendGridApiKey) {
    sgMail.setApiKey(sendGridApiKey);
    console.log('[Notification Service] ✅ SendGrid initialized with API key');
} else {
    console.log('[Notification Service] ⚠️ SendGrid API key not set. Emails will be logged to console only.');
}

/**
 * Notify owner that their card has been found
 * @param {Object} owner - Owner object with email, name, etc.
 * @param {Object} card - Card object with location, pickup code, etc.
 * @returns {Promise<boolean>} Success status
 */
export async function notifyOwnerOfFoundCard(owner, card) {
    console.log(`[Notification Service] Preparing to notify owner:`, {
        email: owner.email,
        name: owner.fullName,
        cardId: card.id
    });

    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {
        console.log('[Notification Service] SendGrid not configured - email would be sent to:', owner.email);
        const emailContent = getEmailContent(owner, card);
        console.log('[Notification Service] Email content:');
        console.log('---');
        console.log(emailContent.text);
        console.log('---');
        return false;
    }

    if (!owner.email) {
        console.error('[Notification Service] No email address provided for owner');
        return false;
    }

    try {
        const emailContent = getEmailContent(owner, card);

        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@lostid.sdsu.edu';
        const msg = {
            to: owner.email,
            from: fromEmail,
            subject: 'Your SDSU ID Card Has Been Found!',
            text: emailContent.text,
            html: emailContent.html
        };

        console.log(`[Notification Service] Attempting to send email via SendGrid:`, {
            to: owner.email,
            from: fromEmail,
            subject: msg.subject
        });

        const result = await sgMail.send(msg);
        console.log(`[Notification Service] SendGrid response:`, JSON.stringify(result, null, 2));
        console.log(`[Notification Service] ✅ Email sent successfully to ${owner.email}`);
        return true;
    } catch (error) {
        console.error('[Notification Service] ❌ Error sending email:', error);
        if (error.response) {
            console.error('[Notification Service] SendGrid error response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: JSON.stringify(error.response.body, null, 2)
            });
        } else {
            console.error('[Notification Service] Error details:', error.message);
            console.error('[Notification Service] Error stack:', error.stack);
        }
        return false;
    }
}

/**
 * Generate email content based on card status
 */
function getEmailContent(owner, card) {
    const ownerName = owner.fullName || 'SDSU Student';
    // Generate reference code from card ID (first 8 characters, uppercase)
    const referenceCode = card.id ? card.id.substring(0, 8).toUpperCase() : 'N/A';
    let text = '';
    let html = '';

    if (card.boxId && card.pickupCode) {
        // Card is in a pickup box
        text = `
Hello ${ownerName},

Great news! Your SDSU ID card has been found and is ready for pickup.

REFERENCE CODE: ${referenceCode}

PICKUP LOCATION: ${card.boxId}
PICKUP CODE: ${card.pickupCode}

Please go to ${card.boxId} and enter the pickup code ${card.pickupCode} to retrieve your card.

${card.locationDescription ? `Drop-off Location: ${card.locationDescription}` : ''}

You can check your card status anytime using your reference code: ${referenceCode}

If you have any questions, please contact us.

Best regards,
Clumsy Aztecs
    `.trim();

    html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #C41230; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .code-box { background-color: #fff; border: 2px solid #C41230; padding: 15px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold; }
    .ref-code-box { background-color: #fff; border: 2px solid #C41230; padding: 12px; margin: 20px 0; text-align: center; font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: 0.1em; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your SDSU ID Card Has Been Found!</h1>
    </div>
    <div class="content">
      <p>Hello ${ownerName},</p>
      <p>Great news! Your SDSU ID card has been found and is ready for pickup.</p>

      <p><strong>Reference Code:</strong></p>
      <div class="ref-code-box">${referenceCode}</div>
      <p style="font-size: 13px; color: #666; margin-top: -10px;">Use this code to check your card status anytime</p>

      <p><strong>Pickup Location:</strong> ${card.boxId}</p>
      <div class="code-box">${card.pickupCode}</div>
      <p>Please go to <strong>${card.boxId}</strong> and enter the pickup code above to retrieve your card.</p>

      ${card.locationDescription ? `<p><strong>Drop-off Location:</strong> ${card.locationDescription}</p>` : ''}

      <p>If you have any questions, please contact us.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>Clumsy Aztecs</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  } else if (card.finderContact) {
    // Card found by someone who left contact info
    text = `
Hello ${ownerName},

Your SDSU ID card has been found!

REFERENCE CODE: ${referenceCode}

The person who found your card has provided contact information:
${card.finderContact}

${card.locationDescription ? `Drop-off Location: ${card.locationDescription}` : ''}

Please contact them to arrange pickup of your card.

You can check your card status anytime using your reference code: ${referenceCode}

Best regards,
Clumsy Aztecs
    `.trim();

    html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #C41230; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .contact-box { background-color: #fff; border: 2px solid #C41230; padding: 15px; margin: 20px 0; }
    .ref-code-box { background-color: #fff; border: 2px solid #C41230; padding: 12px; margin: 20px 0; text-align: center; font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: 0.1em; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your SDSU ID Card Has Been Found!</h1>
    </div>
    <div class="content">
      <p>Hello ${ownerName},</p>
      <p>Your SDSU ID card has been found!</p>

      <p><strong>Reference Code:</strong></p>
      <div class="ref-code-box">${referenceCode}</div>
      <p style="font-size: 13px; color: #666; margin-top: -10px;">Use this code to check your card status anytime</p>

      <div class="contact-box">
        <p><strong>Contact the finder:</strong></p>
        <p>${card.finderContact}</p>
      </div>

      ${card.locationDescription ? `<p><strong>Drop-off Location:</strong> ${card.locationDescription}</p>` : ''}

      <p>Please contact them to arrange pickup of your card.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>Clumsy Aztecs</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  } else {
    // Generic found message
    text = `
Hello ${ownerName},

Your SDSU ID card has been found!

REFERENCE CODE: ${referenceCode}

${card.locationDescription ? `Drop-off Location: ${card.locationDescription}` : 'Drop-off location information not provided.'}

Please check Clumsy Aztecs for more details: http://localhost:5173/status

You can check your card status anytime using your reference code: ${referenceCode}

Best regards,
Clumsy Aztecs
    `.trim();

    html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #C41230; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your SDSU ID Card Has Been Found!</h1>
    </div>
    <div class="content">
      <p>Hello ${ownerName},</p>
      <p>Your SDSU ID card has been found!</p>

      <p><strong>Reference Code:</strong></p>
      <div class="ref-code-box">${referenceCode}</div>
      <p style="font-size: 13px; color: #666; margin-top: -10px;">Use this code to check your card status anytime</p>

      ${card.locationDescription ? `<p><strong>Drop-off Location:</strong> ${card.locationDescription}</p>` : '<p>Drop-off location information not provided.</p>'}

      <p>Please check <a href="http://localhost:5173/status">Clumsy Aztecs</a> for more details.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>Clumsy Aztecs</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  return { text, html };
}