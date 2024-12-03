#include <WiFi.h>
#include <WiFiClientSecure.h>

const char* ssid = "NTFiber-e262";
const char* password = "SXy9vPgP";
const char* serverName = "gps-7qjm.onrender.com"; // Replace with your server endpoint

void sendPostRequest() {
  WiFiClientSecure client;
  client.setInsecure();  // For testing purposes; in production, use proper certificates.

  if (client.connect(serverName, 443)) { // HTTPS uses port 443
    Serial.println("Connected to server!");

    String postData = "{\"key\":\"value\"}";  // Replace with your actual POST data

    // HTTP POST request
    client.println("POST /api/gpsdata HTTP/1.1"); // Replace `/endpoint` with your route
    client.println("Host: gps-7qjm.onrender.com");
    client.println("Content-Type: application/json");
    client.print("Content-Length: ");
    client.println(postData.length());
    client.println();  // End of headers
    client.print(postData);

    // Read the response
    while (client.connected()) {
      String line = client.readStringUntil('\n');
      if (line == "\r") {
        Serial.println("Headers received");
        break;
      }
    }

    // Print response payload
    String response = client.readString();
    Serial.println("Response:");
    Serial.println(response);

    client.stop(); // Close the connection
  } else {
    Serial.println("Connection failed!");
  }
}

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi!");
}

void loop() {
  sendPostRequest(); // Send the POST request
  delay(5000);       // Wait for 5 seconds
}
