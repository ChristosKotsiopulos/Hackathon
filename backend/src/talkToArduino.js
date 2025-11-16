/**
 * Arduino Communication Module
 * Handles sending pickup codes to Arduino via Serial Port
 */

import { SerialPort } from 'serialport';

// Store all pickup codes with their associated card info
const pickupCodesStore = [];

// Serial port connection (will be initialized when Arduino is connected)
let serialPort = null;
let isPortOpen = false;

// Common Arduino serial port paths (will try to auto-detect)
// Note: On macOS, use 'cu.' for outgoing serial connections (not 'tty.')
const commonPorts = [
    '/dev/cu.usbmodem101',  // macOS - Your Arduino (found via port scanner)
    '/dev/cu.usbserial-110', // macOS - Alternative port
    '/dev/cu.usbmodem110',  // macOS (Arduino 110)
    '/dev/cu.usbmodem1101', // macOS
    '/dev/ttyUSB0',         // Linux
    '/dev/ttyACM0',         // Linux
    'COM3',                 // Windows
    'COM4'                  // Windows
];

/**
 * Initialize serial port connection to Arduino
 * @param {string} portPath - Optional port path, will auto-detect if not provided
 */
export async function initializeArduinoConnection(portPath = null) {
    if (isPortOpen && serialPort) {
        console.log('[Arduino] Serial port already connected');
        return true;
    }

    const path = portPath || await findArduinoPort();

    if (!path) {
        console.log('[Arduino] ⚠️ No Arduino port found. Pickup codes will be stored but not sent.');
        console.log('[Arduino] 💡 Tip: Close Arduino IDE Serial Monitor if it\'s open, then restart server');
        return false;
    }

    try {
        serialPort = new SerialPort({
            path: path,
            baudRate: 9600,
            autoOpen: false
        });

        serialPort.open((err) => {
            if (err) {
                if (err.message.includes('Cannot lock port') || err.message.includes('Resource temporarily unavailable')) {
                    console.error('[Arduino] ❌ Port is locked. Close Arduino IDE Serial Monitor and restart server.');
                } else {
                    console.error('[Arduino] ❌ Error opening port:', err.message);
                }
                isPortOpen = false;
                return false;
            }
            isPortOpen = true;
            console.log(`[Arduino] ✅ Connected to ${path}`);
            console.log('[Arduino] 📡 Ready to send pickup codes');

            // Send all stored codes to Arduino
            sendAllStoredCodes();
        });

        // Listen for Arduino responses
        serialPort.on('data', (data) => {
            console.log('[Arduino] 📥 Received:', data.toString().trim());
        });

        serialPort.on('error', (err) => {
            if (!err.message.includes('Serial port is closed')) {
                console.error('[Arduino] ❌ Serial port error:', err.message);
            }
            isPortOpen = false;
        });

        serialPort.on('close', () => {
            console.log('[Arduino] ⚠️ Serial port closed');
            isPortOpen = false;
        });

        return true;
    } catch (error) {
        console.error('[Arduino] ❌ Error initializing serial port:', error.message);
        return false;
    }
}

/**
 * Find Arduino port by trying common paths or auto-detecting
 * @returns {Promise<string|null>} Port path or null
 */
async function findArduinoPort() {
    try {
        // Try to auto-detect using SerialPort.list()
        const { SerialPort } = await
        import ('serialport');
        const ports = await SerialPort.list();

        // Look for USB modem ports (Arduino typically shows up as usbmodem)
        // Prefer ports with Arduino manufacturer, then usbmodem, then usbserial
        const arduinoPort = ports.find(port => {
            const hasArduinoManufacturer = port.manufacturer && port.manufacturer.toLowerCase().includes('arduino');
            const hasUsbModem = port.path.includes('usbmodem');
            const hasUsbSerial = port.path.includes('usbserial');
            return hasArduinoManufacturer || hasUsbModem || hasUsbSerial;
        });
        
        // If found, convert tty. to cu. for macOS (cu. is for outgoing connections)
        if (arduinoPort && arduinoPort.path.startsWith('/dev/tty.')) {
            const cuPath = arduinoPort.path.replace('/dev/tty.', '/dev/cu.');
            console.log(`[Arduino] 🔄 Converting tty. to cu.: ${arduinoPort.path} → ${cuPath}`);
            return cuPath;
        }

        if (arduinoPort) {
            console.log(`[Arduino] 🔍 Auto-detected port: ${arduinoPort.path}`);
            return arduinoPort.path;
        }

        // Fallback to common ports
        console.log('[Arduino] 🔍 Trying common ports...');
        return commonPorts[0] || null;
    } catch (error) {
        console.log('[Arduino] ⚠️ Could not auto-detect port, using default');
        return commonPorts[0] || null;
    }
}

/**
 * Store a pickup code and send it to Arduino
 * @param {string} pickupCode - The pickup code (4 digits, 1-4)
 * @param {string} boxId - The box ID
 * @param {string} cardId - The card ID
 */
export function sendPickupCodeToArduino(pickupCode, boxId, cardId) {
    if (!pickupCode || !boxId) {
        console.log('[Arduino] ⚠️ Invalid pickup code or boxId, not sending');
        return;
    }

    // Store the code
    const codeEntry = {
        pickupCode,
        boxId,
        cardId,
        timestamp: new Date(),
        sent: false
    };

    pickupCodesStore.push(codeEntry);
    console.log(`[Arduino] 📦 Stored pickup code: ${pickupCode} for ${boxId} (Card: ${cardId})`);

    // Try to initialize connection if not already connected
    if (!isPortOpen) {
        initializeArduinoConnection().catch(err => {
            console.error('[Arduino] Error initializing connection:', err);
        });
    }

    // Send to Arduino if port is open
    if (isPortOpen && serialPort) {
        sendCodeToArduino(pickupCode, boxId);
        codeEntry.sent = true;
    } else {
        console.log(`[Arduino] ⚠️ Port not open, code ${pickupCode} will be sent when Arduino connects`);
    }
}

/**
 * Send a single code to Arduino
 * @param {string} pickupCode - The pickup code
 * @param {string} boxId - The box ID
 */
function sendCodeToArduino(pickupCode, boxId) {
    if (!serialPort || !isPortOpen) {
        console.log('[Arduino] ⚠️ Cannot send: serial port not open');
        return;
    }

    try {
        // Format: "CODE:1234:BOX_1\n"
        const message = `CODE:${pickupCode}:${boxId}\n`;
        serialPort.write(message, (err) => {
            if (err) {
                console.error('[Arduino] ❌ Error writing to port:', err.message);
            } else {
                console.log(`[Arduino] ✅ Sent: ${pickupCode} to ${boxId}`);
            }
        });
    } catch (error) {
        console.error('[Arduino] ❌ Error sending code:', error.message);
    }
}

/**
 * Send all stored pickup codes to Arduino
 */
export function sendAllStoredCodes() {
    if (!isPortOpen || !serialPort) {
        console.log('[Arduino] ⚠️ Cannot send stored codes: port not open');
        return;
    }

    console.log(`[Arduino] 📤 Sending ${pickupCodesStore.length} stored pickup codes...`);

    pickupCodesStore.forEach((entry, index) => {
        setTimeout(() => {
            if (!entry.sent) {
                sendCodeToArduino(entry.pickupCode, entry.boxId);
                entry.sent = true;
            }
        }, index * 500); // Stagger sends by 500ms
    });
}

/**
 * Get all stored pickup codes
 * @returns {Array} Array of pickup code entries
 */
export function getAllStoredCodes() {
    return [...pickupCodesStore];
}

/**
 * Clear stored codes (optional cleanup function)
 */
export function clearStoredCodes() {
    pickupCodesStore.length = 0;
    console.log('[Arduino] 🗑️ Cleared all stored pickup codes');
}

// Try to initialize connection on module load
// You can also call initializeArduinoConnection() manually with a specific port
if (typeof process !== 'undefined') {
    // Only try to connect if running in Node.js (not during tests)
    setTimeout(async() => {
        await initializeArduinoConnection();
    }, 2000); // Wait 2 seconds for system to be ready
}