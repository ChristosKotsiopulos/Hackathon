/*
 * Clumsy Aztecs - Arduino Box Controller with WiFi
 * Based on your original code, now with WiFi pickup code verification
 *
 * COPY THIS ENTIRE FILE INTO ARDUINO IDE
 */

#include <Servo.h>
#include <ESP8266WiFi.h>  // For ESP8266
// #include <WiFi.h>      // For ESP32 (uncomment if using ESP32)
#include <HTTPClient.h>

Servo lockServo;

// Servo positions (from your original code)
const int OPEN_POS = 90;    // adjust depending on your mechanism
const int CLOSED_POS = 0;   // adjust depending on your mechanism
const int OPEN_TIME = 10000; // 10 seconds (in milliseconds) - you can change this

// WiFi credentials - UPDATE THESE!
const char* ssid = "YOUR_WIFI_SSID";        // Change this to your WiFi name
const char* password = "YOUR_WIFI_PASSWORD"; // Change this to your WiFi password

// Backend server - UPDATE THIS WITH YOUR COMPUTER'S IP!
const char* serverUrl = "http://10.130.55.25:4000";  // Change 10.130.55.25 to your computer's IP
const String boxId = "BOX_1";  // Your box identifier

// Code entry
String inputCode = "";

// Store valid pickup codes received from backend
String validCodes[20];  // Store up to 20 codes
int codeCount = 0;

// Serial input buffer for receiving codes from backend
String serialBuffer = "";

WiFiClient client;
HTTPClient http;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize servo (from your original code)
  lockServo.attach(6);    // servo signal pin
  lockServo.write(CLOSED_POS);

  // Connect to WiFi
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Server: ");
    Serial.println(serverUrl);
    Serial.println("Ready to verify codes!");
    Serial.println("Enter code:");
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
    Serial.println("Check your WiFi credentials.");
  }
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.begin(ssid, password);
    delay(5000);
    return;
  }

  // Poll for web app open requests (check every 2 seconds)
  static unsigned long lastPoll = 0;
  if (millis() - lastPoll > 2000) {
    checkForOpenRequest();
    lastPoll = millis();
  }

  // Check for incoming serial data from backend (CODE:1234:BOX_1 format)
  if (Serial.available() > 0) {
    char c = Serial.read();
    
    // Check if this is a message from backend (starts with "CODE:")
    if (c == 'C' || serialBuffer.length() > 0) {
      serialBuffer += c;
      
      // Check if we have a complete line
      if (c == '\n' || c == '\r') {
        serialBuffer.trim();
        
        // Parse format: "CODE:1234:BOX_1"
        if (serialBuffer.startsWith("CODE:")) {
          int codeStart = 5; // After "CODE:"
          int codeEnd = serialBuffer.indexOf(':', codeStart);
          
          if (codeEnd > codeStart) {
            String pickupCode = serialBuffer.substring(codeStart, codeEnd);
            String receivedBoxId = serialBuffer.substring(codeEnd + 1);
            
            // Only store if it's for this box
            if (receivedBoxId == boxId) {
              addValidCode(pickupCode);
              Serial.print("✅ Received code from backend: ");
              Serial.println(pickupCode);
            }
          }
        }
        
        serialBuffer = "";
      }
      
      // Reset if buffer gets too long (not a CODE message)
      if (serialBuffer.length() > 50) {
        serialBuffer = "";
      }
    }
    // Otherwise, treat as user input (digits 1-4)
    else if (c >= '1' && c <= '4') {
      if (inputCode.length() < 4) {
        inputCode += c;
        Serial.print(c);  // Show the digit
      }
    }
    // If user presses enter or code is complete
    else if (c == '\n' || c == '\r' || inputCode.length() == 4) {
      if (inputCode.length() == 4) {
        Serial.println();
        checkCode();
        inputCode = "";
        Serial.println("Enter code:");
      }
    }
    // Clear on backspace
    else if (c == '\b' || c == 127) {
      if (inputCode.length() > 0) {
        inputCode = inputCode.substring(0, inputCode.length() - 1);
        Serial.print("\b \b");
      }
    }
  }

  delay(50);
}

// Check if web app requested box to open
void checkForOpenRequest() {
  String url = String(serverUrl) + "/api/arduino/check-open?boxId=" + boxId;
  http.begin(client, url);

  int httpResponseCode = http.GET();

  if (httpResponseCode > 0) {
    String response = http.getString();

    // Check if should open
    if (response.indexOf("\"shouldOpen\":true") > 0) {
      Serial.println("Web app requested box open. Opening...");
      openDoor();

      // After opening, confirm to backend by calling pickup-request
      // Extract pickup code from response if available, or use the one we got
      int pickupCodeStart = response.indexOf("\"pickupCode\":\"");
      if (pickupCodeStart > 0) {
        pickupCodeStart += 14; // Length of "pickupCode":"
        int pickupCodeEnd = response.indexOf("\"", pickupCodeStart);
        if (pickupCodeEnd > pickupCodeStart) {
          String code = response.substring(pickupCodeStart, pickupCodeEnd);
          confirmPickup(code);
        }
      }
    }
  }

  http.end();
}

// Confirm pickup to backend (marks card as picked_up)
void confirmPickup(String code) {
  String url = String(serverUrl) + "/api/pickup-request";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"pickupCode\":\"" + code + "\",\"boxId\":\"" + boxId + "\"}";
  http.POST(jsonPayload);
  http.end();

  Serial.println("Pickup confirmed to backend.");
}

// Add a valid code to the stored list
void addValidCode(String code) {
  // Check if code already exists
  for (int i = 0; i < codeCount; i++) {
    if (validCodes[i] == code) {
      return; // Already stored
    }
  }
  
  // Add to list if there's space
  if (codeCount < 20) {
    validCodes[codeCount] = code;
    codeCount++;
    Serial.print("📦 Stored code: ");
    Serial.println(code);
    Serial.print("Total codes: ");
    Serial.println(codeCount);
  } else {
    Serial.println("⚠️ Code storage full!");
  }
}

// Check if a code is valid (both in stored list and via backend)
void checkCode() {
  Serial.print("Verifying code: ");
  Serial.println(inputCode);
  
  // First check if code is in stored list (fast check)
  bool foundInList = false;
  for (int i = 0; i < codeCount; i++) {
    if (validCodes[i] == inputCode) {
      foundInList = true;
      Serial.println("✅ Code found in stored list!");
      break;
    }
  }
  
  // Also verify with backend (for security and status update)
  Serial.print("Connecting to server... ");

  // Connect to backend API
  String url = String(serverUrl) + "/api/pickup-request";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  String jsonPayload = "{\"pickupCode\":\"" + inputCode + "\",\"boxId\":\"" + boxId + "\"}";
  Serial.println("Sending: " + jsonPayload);

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);

    String response = http.getString();
    Serial.println("Response: " + response);

    // Check if code is valid
    if (httpResponseCode == 200 && response.indexOf("\"ok\":true") > 0) {
      Serial.println("✅ Code verified by backend. Opening...");
      openDoor();
    } else {
      if (foundInList) {
        Serial.println("⚠️ Code in list but backend rejected. Not opening.");
      } else {
        Serial.println("❌ Incorrect code.");
      }
    }
  } else {
    // If backend is unreachable but code is in list, allow it (offline mode)
    if (foundInList) {
      Serial.println("⚠️ Backend unreachable, but code is valid. Opening...");
      openDoor();
    } else {
      Serial.print("❌ Connection failed. Error: ");
      Serial.println(httpResponseCode);
      Serial.println("Check:");
      Serial.println("  1. Backend server is running");
      Serial.println("  2. IP address is correct: " + String(serverUrl));
      Serial.println("  3. Arduino and computer on same WiFi");
    }
  }

  http.end();
}

void openDoor() {
  // From your original code
  lockServo.write(OPEN_POS);
  Serial.println("Door open for 10 seconds.");

  delay(OPEN_TIME);    // Wait 10 seconds

  Serial.println("Closing door.");
  lockServo.write(CLOSED_POS);
}

