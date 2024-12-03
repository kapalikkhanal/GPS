#include <SoftwareSerial.h>
#include <TinyGPS++.h>

// SoftwareSerial for SIM800L and GPS module
SoftwareSerial sim800(2, 3);      // SIM800L (RX, TX)
SoftwareSerial gpsSerial(9, 10);  // GPS module (RX, TX)

TinyGPSPlus gps;

void setup() {
  Serial.begin(9600);     // Debugging via Serial Monitor
  sim800.begin(9600);     // SIM800L communication
  gpsSerial.begin(9600);  // GPS module communication

  Serial.println("Initializing...");

  // Initialize SIM800L
  sendATCommand("AT");
  sendATCommand("AT+CSQ");
  sendATCommand("AT+CGATT=1");
  sendATCommand("AT+CSTT=\"internet\",\"\",\"\"");  // Set APN (update if needed)
  sendATCommand("AT+CIICR");
  sendATCommand("AT+CIFSR");

  // Enable SSL for HTTPS communication
  sendATCommand("AT+HTTPSSL=1");
}

void loop() {
  // Read GPS data
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    gps.encode(c);

    // If a valid GPS location is available
    if (gps.location.isUpdated()) {
      String gpsData = formatGPSData();
      sendHTTPSPostRequest(gpsData);  // Send GPS data via HTTPS
      delay(10000);                   // Wait 10 seconds before next update
    }
  }
}

String formatGPSData() {
  String lat = String(gps.location.lat(), 6);  // Latitude with 6 decimal places
  String lng = String(gps.location.lng(), 6);  // Longitude with 6 decimal places
  String gpsData = "{\"lat\":" + lat + ",\"lng\":" + lng + "}";
  Serial.println("GPS Data: " + gpsData);
  return gpsData;
}

void sendHTTPSPostRequest(String data) {
  sendATCommand("AT+HTTPINIT");                                               // Initialize HTTP service
  sendATCommand("AT+HTTPPARA=\"CID\",1");                                     // Set context ID (1 is default)
  sendATCommand("AT+HTTPPARA=\"URL\",\"https://your-server.com/endpoint\"");  // Replace with your endpoint URL
  sendATCommand("AT+HTTPPARA=\"CONTENT\",\"application/json\"");              // Set content type to JSON

  // Send data
  sim800.print("AT+HTTPDATA=");  // Prepare to send HTTP data
  sim800.print(data.length());
  sim800.println(",10000");  // Timeout of 10 seconds for data input
  delay(2000);
  sim800.print(data);  // Send JSON payload
  delay(2000);

  sendATCommand("AT+HTTPACTION=1");  // Send POST request
  delay(6000);                       // Wait for server response

  sendATCommand("AT+HTTPREAD");  // Read server response
  sendATCommand("AT+HTTPTERM");  // Terminate HTTP service
}

void sendATCommand(String command) {
  sim800.println(command);
  delay(2000);
  while (sim800.available()) {
    Serial.write(sim800.read());
  }
}
