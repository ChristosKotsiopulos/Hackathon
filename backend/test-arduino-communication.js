/**
 * Test Arduino Serial Communication
 * Run: node test-arduino-communication.js
 * 
 * This tests if the backend can communicate with Arduino via Serial Port
 */

import { 
    initializeArduinoConnection,
    sendPickupCodeToArduino,
    getAllStoredCodes
} from './src/talkToArduino.js';

console.log('🧪 Testing Arduino Communication...\n');
console.log('📋 Note: Arduino communicates with Backend (Node.js), not VSCode directly.\n');
console.log('   VSCode is just the editor. Backend sends codes via Serial Port.\n');

// Try to find Arduino port
async function testConnection() {
    let connected = false;
    
    // Try auto-detect first
    console.log('🔍 Step 1: Auto-detecting Arduino port...\n');
    connected = await initializeArduinoConnection(null);
    
    if (!connected) {
        // Try common ports
        console.log('🔍 Step 2: Trying common ports...\n');
        const portsToTry = [
            '/dev/cu.usbmodem110',
            '/dev/cu.usbserial-110',
            '/dev/cu.usbmodem101'
        ];
        
        for (const port of portsToTry) {
            console.log(`   Trying: ${port}...`);
            connected = await initializeArduinoConnection(port);
            if (connected) {
                console.log(`   ✅ Connected to ${port}!\n`);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    if (!connected) {
        console.log('\n❌ Could not connect to Arduino.\n');
        console.log('💡 Troubleshooting:');
        console.log('   1. Make sure Arduino is connected via USB');
        console.log('   2. Close Arduino IDE Serial Monitor');
        console.log('   3. Check Arduino IDE: Tools → Port (to find your port)');
        console.log('   4. Update port in talkToArduino.js if needed');
        process.exit(1);
    }
    
    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test sending a code
    console.log('📦 Step 3: Sending test pickup code: 1234 to BOX_1...\n');
    sendPickupCodeToArduino('1234', 'BOX_1', 'test-card-123');
    
    // Wait and check results
    setTimeout(() => {
        console.log('\n📋 Step 4: Checking stored codes...');
        const codes = getAllStoredCodes();
        if (codes.length > 0) {
            console.log(JSON.stringify(codes, null, 2));
            console.log('\n✅ Communication test successful!\n');
            console.log('💡 Next steps:');
            console.log('   1. Open Arduino IDE Serial Monitor (115200 baud)');
            console.log('   2. You should see: "✅ Received code from backend: 1234"');
            console.log('   3. Type code "1234" in Serial Monitor');
            console.log('   4. Motor should open for 10 seconds!\n');
        } else {
            console.log('   ⚠️  Code stored but may not have been sent yet');
        }
        
        process.exit(0);
    }, 3000);
}

testConnection().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
