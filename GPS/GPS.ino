#include <WiFi.h>
#include <WiFiClientSecure.h>

const char* ssid = "Kapalik's Iphone";
const char* password = "Password";
const char* serverName = "gps-7qjm.onrender.com";  // Server without https prefix

// Root CA certificate for Let's Encrypt (common for Render)
const char* rootCACertificate =
  "-----BEGIN CERTIFICATE-----\n"
  "...Your Root CA Certificate Here...\n"
  "-----END CERTIFICATE-----\n";

void scanWiFiNetworks() {
  Serial.println("Scanning for Wi-Fi networks...");
  int networks = WiFi.scanNetworks();

  if (networks == 0) {
    Serial.println("No Wi-Fi networks found.");
  } else {
    Serial.printf("%d networks found:\n", networks);
    for (int i = 0; i < networks; i++) {
      Serial.printf("%d: %s (%ddBm) %s\n",
                    i + 1,
                    WiFi.SSID(i).c_str(),
                    WiFi.RSSI(i),
                    (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Secured");
    }
  }
  WiFi.scanDelete();  // Clear scan results
}

void printWiFiData() {
  Serial.println("Wi-Fi Details:");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.print("Subnet Mask: ");
  Serial.println(WiFi.subnetMask());

  Serial.print("Gateway IP: ");
  Serial.println(WiFi.gatewayIP());

  Serial.print("DNS IP: ");
  Serial.println(WiFi.dnsIP());

  Serial.print("Wi-Fi RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

void resolveHostname() {
  Serial.println("Resolving hostname...");
  IPAddress serverIP;
  if (WiFi.hostByName(serverName, serverIP)) {
    Serial.print("Resolved IP: ");
    Serial.println(serverIP);
  } else {
    Serial.println("Hostname resolution failed!");
  }
}

void sendPostRequest() {
  WiFiClientSecure client;

  // Set root CA certificate
  client.setCACert(rootCACertificate);

  Serial.println("Attempting to connect...");

  int connectAttempts = 3;
  while (connectAttempts > 0 && !client.connect(serverName, 443)) {
    Serial.printf("Connection attempt failed. Remaining attempts: %d\n", connectAttempts);
    delay(2000);
    connectAttempts--;
  }

  if (!client.connected()) {
    Serial.println("Failed to connect to server.");
    return;
  }

  Serial.println("Connected to server. Sending POST request...");
  String postData = "{\"lat\":\"20.2222\",\"lng\":\"85.5445\"}";

  client.println("POST /api/gpsdata HTTP/1.1");
  client.printf("Host: %s\r\n", serverName);
  client.println("Content-Type: application/json");
  client.printf("Content-Length: %d\r\n", postData.length());
  client.println();
  client.print(postData);

  unsigned long timeout = millis();
  while (client.connected() && (millis() - timeout < 10000)) {
    if (client.available()) {
      String response = client.readStringUntil('\n');
      Serial.println(response);
    }
  }

  client.stop();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Starting...");

  // scanWiFiNetworks(); // Scan and display Wi-Fi networks
  IPAddress local_IP(192, 168, 101, 200);  // Choose an unused IP in the subnet
  IPAddress gateway(192, 168, 101, 1);     // Router's IP
  IPAddress subnet(255, 255, 255, 0);      // Subnet mask
  IPAddress primaryDNS(8, 8, 8, 8);        // Google DNS
  IPAddress secondaryDNS(8, 8, 4, 4);      // Google DNS

  WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
  WiFi.begin("Ka Pa Lik", "Password@49717");


  // WiFi.begin(ssid, password);
  Serial.println("Connecting to Wi-Fi...");

  int attempts = 10;  // Maximum attempts to connect
  while (WiFi.status() != WL_CONNECTED && attempts > 0) {
    delay(1000);
    Serial.print(".");
    attempts--;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to Wi-Fi.");
    printWiFiData();
    resolveHostname();
  } else {
    Serial.println("\nFailed to connect to Wi-Fi. Check credentials or signal strength.");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    sendPostRequest();
  } else {
    Serial.println("Wi-Fi disconnected. Attempting to reconnect...");
    WiFi.begin(ssid, password);
  }
  delay(10000);
}
