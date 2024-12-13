#include <WiFi.h>
#include "Arduino.h"
#include <WiFiClientSecure.h>
#include <MQTTPubSubClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <WiFiManager.h>

// Configuration constants
// const char* WIFI_SSID = "Kapalik's Iphone";
// const char* WIFI_PASSWORD = "Password";
const char* MQTT_HOST = "mqtt.ably.io";
const int MQTT_PORT = 8883;
const char* MQTT_USERNAME = "yMJ3VQ.PxwimQ";
const char* MQTT_PASSWORD = "Vw4oM1CCMxx0tm8xTIZtda72vNj3SmNkLbVPipSt5Ek";
const char* MERCHANT_ID = "005000827602524";
const char* ID = "1998";

//Leds
int wifiPin = 6;
int brokerPin = 7;
int statusPin = 15;

// Timing constants
const unsigned long PUBLISH_INTERVAL = 10000;    // 10 seconds
const unsigned long WIFI_TIMEOUT = 20000;        // 20 seconds
const unsigned long MQTT_TIMEOUT = 10000;        // 10 seconds
const unsigned long RECONNECT_DELAY = 5000;      // 5 seconds
const unsigned long GPS_UPDATE_INTERVAL = 1000;  // 1 second
const int MAX_RETRY_ATTEMPTS = 3;

// Buffer sizes
const size_t JSON_BUFFER_SIZE = 1024;
const size_t TOPIC_BUFFER_SIZE = 128;
const size_t MESSAGE_BUFFER_SIZE = 512;

// Global variables
WiFiManager wifiManager;
WiFiClientSecure wifiClient;
MQTTPubSubClient mqtt;

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

unsigned long lastPublishTime = 0;
unsigned long lastGPSUpdateTime = 0;
unsigned long lastWifiCheckTime = 0;
unsigned long lastHeartbeatTime = 0;
int reconnectAttempts = 0;
bool isMqttConnected = false;

// Device state
struct DeviceState {
  float latitude;
  float longitude;
  float speed;
  float altitude;
  int satellites;
  bool locationValid;
  unsigned long bootCount;
} state;

// Function declarations
bool setupWiFi();
bool setupMQTT();
bool publishLocation();
void handleMQTTMessage(const String& topic, const String& payload);
void reconnectServices();
bool isWiFiConnected();
void loadConfiguration();
void saveConfiguration();
void logMessage(const char* message, bool isError = false);

void setup() {
  Serial.begin(115200);

  pinMode(wifiPin, OUTPUT);
  pinMode(brokerPin, OUTPUT);
  pinMode(statusPin, OUTPUT);
  // Initialize EEPROM
  EEPROM.begin(512);
  loadConfiguration();

  // Initialize GPS with timeout check
  logMessage("Initializing GPS module...");
  gpsSerial.begin(9600, SERIAL_8N1, 5, 4);

  // Wait for GPS module to respond (with timeout)
  unsigned long startTime = millis();
  bool gpsFound = false;
  const unsigned long GPS_INIT_TIMEOUT = 5000;  // 5 second timeout

  while ((millis() - startTime) < GPS_INIT_TIMEOUT) {
    if (gpsSerial.available() > 0) {
      gpsFound = true;
      break;
    }
    delay(100);
  }

  if (gpsFound) {
    logMessage("GPS module initialized successfully");
  } else {
    logMessage("GPS module initialization failed - no data received", true);
  }

  // Initialize state
  state.locationValid = false;

  // Setup WiFi and MQTT
  setupWiFi();



  setupMQTT();

  // Increment and save boot count
  state.bootCount++;
  saveConfiguration();

  logMessage("Device initialization complete");
}

bool setupWiFi() {
  logMessage("Connecting to WiFi...");

  wifiManager.setConfigPortalTimeout(180);

  if (!wifiManager.autoConnect("ESP32-DeviceAP")) {
    logMessage("Failed to connect and hit timeout", true);
    // Restart and try again, or handle as needed
    // ESP.restart();
    return false;
  }

  // WiFi.mode(WIFI_STA);
  // WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // if (WiFi.status() != WL_CONNECTED) {
  //   if (millis() - startAttempt > WIFI_TIMEOUT) {
  //     logMessage("WiFi connection timeout", true);
  //     return false;
  //   }
  //   delay(500);
  // }

  logMessage("WiFi connected");
  digitalWrite(wifiPin, HIGH);
  char ipStr[20];
  sprintf(ipStr, "IP: %s", WiFi.localIP().toString().c_str());
  logMessage(ipStr);
  return true;
}

bool setupMQTT() {
  logMessage("Setting up MQTT...");

  wifiClient.setInsecure();  // In production, consider using proper certificates

  // Connect to MQTT broker
  while (!wifiClient.connect(MQTT_HOST, MQTT_PORT)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("Host connected!");

  mqtt.begin(wifiClient);

  Serial.print("Connecting to mqtt broker...");

  while (!mqtt.connect(MERCHANT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("Broker connected!");
  digitalWrite(brokerPin, HIGH);

  // Subscribe to topics
  String subscribeTopic = String(MERCHANT_ID);
  if (!mqtt.subscribe(subscribeTopic, [subscribeTopic](const String& payload, const size_t size) {
        handleMQTTMessage(subscribeTopic, payload);
      })) {
    logMessage("MQTT subscription failed", true);
    return false;
  }

  isMqttConnected = true;
  logMessage("MQTT setup complete");
  return true;
}

void handleMQTTMessage(const String& topic, const String& payload) {
  char msgBuffer[MESSAGE_BUFFER_SIZE];

  snprintf(msgBuffer, MESSAGE_BUFFER_SIZE, "Received message on topic: %s", topic.c_str());
  logMessage(msgBuffer);

  snprintf(msgBuffer, MESSAGE_BUFFER_SIZE, "Payload: %s", payload.c_str());
  logMessage(msgBuffer);

  // Parse JSON payload
  StaticJsonBuffer<JSON_BUFFER_SIZE> jsonBuffer;
  JsonObject& root = jsonBuffer.parseObject(payload);

  if (!root.success()) {
    logMessage("Failed to parse JSON payload", true);
    return;
  }

  // Handle different message types
  const char* messageType = root["type"];
  if (messageType) {
    if (strcmp(messageType, "config") == 0) {
      // Handle configuration updates
      if (root.containsKey("publishInterval")) {
        // Update publish interval
      }
    } else if (strcmp(messageType, "command") == 0) {
      // Handle commands
    }
  }
}

bool attemptMqttReconnect() {
  logMessage("Attempting MQTT reconnection...");

  // First check WiFi
  if (!isWiFiConnected()) {
    logMessage("WiFi disconnected, attempting to reconnect...");
    if (!setupWiFi()) {
      return false;
    }
  }

  // Attempt MQTT connection
  wifiClient.setInsecure();  // Maintain your existing security settings

  if (!wifiClient.connect(MQTT_HOST, MQTT_PORT)) {
    logMessage("Failed to connect to MQTT broker", true);
    return false;
  }

  mqtt.begin(wifiClient);

  // Connect with credentials
  if (!mqtt.connect(MERCHANT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    logMessage("MQTT authentication failed", true);
    return false;
  }

  // Resubscribe to topics
  String subscribeTopic = String(MERCHANT_ID);
  mqtt.subscribe(subscribeTopic, [subscribeTopic](const String& payload, const size_t size) {
    handleMQTTMessage(subscribeTopic, payload);
  });

  isMqttConnected = true;
  logMessage("MQTT reconnected successfully");
  return true;
}

bool publishLocation() {

  static int retryCount = 0;
  const int MAX_PUBLISH_RETRIES = 3;
  const unsigned long RETRY_DELAY = 1000;  // 1 second between retries

  // Initial connection check
  if (!isMqttConnected) {
    logMessage("MQTT not connected, attempting reconnect");
    if (!attemptMqttReconnect()) {
      return false;
    }
  }

  if (!state.locationValid) {
    logMessage("No valid GPS data available", true);
    return false;
  }

  
  digitalWrite(statusPin, HIGH);

  // Create JSON document
  StaticJsonBuffer<JSON_BUFFER_SIZE> jsonBuffer;
  JsonObject& jsonDoc = jsonBuffer.createObject();

  // Add data to JSON
  jsonDoc["lat"] = state.latitude;
  jsonDoc["lng"] = state.longitude;
  jsonDoc["speed"] = state.speed;
  jsonDoc["id"] = ID;
  // jsonDoc["altitude"] = state.altitude;
  jsonDoc["sat"] = state.satellites;
  // jsonDoc["timestamp"] = millis();
  // jsonDoc["bootCount"] = state.bootCount;
  // jsonDoc["rssi"] = WiFi.RSSI();

  // Convert to string
  char jsonString[JSON_BUFFER_SIZE];
  jsonDoc.printTo(jsonString, sizeof(jsonString));

  // Create topic string
  char publishTopic[TOPIC_BUFFER_SIZE];
  snprintf(publishTopic, sizeof(publishTopic), "%s/location", MERCHANT_ID);

  // Publish with retries
  for (retryCount = 0; retryCount < MAX_PUBLISH_RETRIES; retryCount++) {
    if (mqtt.publish(publishTopic, jsonString)) {
      if (retryCount > 0) {
        char msgBuffer[64];
        snprintf(msgBuffer, sizeof(msgBuffer), "Data published successfully after %d retries", retryCount);
        logMessage(msgBuffer);
      } else {
        logMessage("Data published successfully");
      }
      return true;
    }

    logMessage("Publish attempt failed", true);

    // // Check connection status and attempt reconnect if needed
    // if (!mqtt.connected()) {
    //     isMqttConnected = false;
    //     logMessage("MQTT connection lost, attempting reconnect...");
    //     if (!attemptMqttReconnect()) {
    //         continue; // Skip to next retry if reconnect fails
    //     }
    // }

    // Wait before retry
    delay(RETRY_DELAY);
  }

  char errorMsg[64];
  snprintf(errorMsg, sizeof(errorMsg), "Failed to publish data after %d attempts", MAX_PUBLISH_RETRIES);
  logMessage(errorMsg, true);
  return false;
}

void reconnectServices() {
  if (reconnectAttempts >= MAX_RETRY_ATTEMPTS) {
    logMessage("Max reconnection attempts reached. Restarting device...", true);
    ESP.restart();
    return;
  }

  reconnectAttempts++;

  if (!isWiFiConnected()) {
    if (!setupWiFi()) {
      return;
    }
  }

  if (!isMqttConnected) {
    if (!attemptMqttReconnect()) {
      return;
    }
  }

  // Reset retry counter on successful reconnection
  if (isWiFiConnected() && isMqttConnected) {
    reconnectAttempts = 0;
  }

  delay(RECONNECT_DELAY);
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void loadConfiguration() {
  // Load saved configuration from EEPROM
  EEPROM.get(0, state);
}

void saveConfiguration() {
  // Save configuration to EEPROM
  EEPROM.put(0, state);
  EEPROM.commit();
}

void logMessage(const char* message, bool isError) {
  char timestamp[20];
  sprintf(timestamp, "[%lu]", millis());
  Serial.print(timestamp);
  Serial.print(isError ? "[ERROR] " : "[INFO] ");
  Serial.println(message);
}

void updateGPSData() {
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isValid()) {
        state.latitude = gps.location.lat();
        state.longitude = gps.location.lng();
        state.locationValid = true;
        state.speed = gps.speed.kmph();
        state.altitude = gps.altitude.meters();
        state.satellites = gps.satellites.value();

        char msgBuffer[MESSAGE_BUFFER_SIZE];
        snprintf(msgBuffer, MESSAGE_BUFFER_SIZE, "GPS Update - Lat: %.6f, Lon: %.6f, Satellites: %d",
                 state.latitude, state.longitude, state.satellites);
        logMessage(msgBuffer);
      } else {
        state.locationValid = false;
      }
    }
  }

  // Check if GPS data is too old
  if (millis() > 5000 && gps.charsProcessed() < 10) {
    logMessage("No GPS data received. Check wiring.", true);
  }
}

void loop() {
  // Check WiFi and MQTT connectivity
  if (!isWiFiConnected() || !isMqttConnected) {
    reconnectServices();
    setupMQTT();
    return;
  }

  // Update MQTT client
  mqtt.update();

  // Update GPS data
  if (millis() - lastGPSUpdateTime >= GPS_UPDATE_INTERVAL) {
    lastGPSUpdateTime = millis();
    updateGPSData();
  }

  // Publish location data at interval
  if (millis() - lastPublishTime >= PUBLISH_INTERVAL) {
    lastPublishTime = millis();
    publishLocation();
  }

  // Send heartbeat every minute
  // if (millis() - lastHeartbeatTime >= 60000) {
  //     lastHeartbeatTime = millis();
  //     char heartbeatTopic[TOPIC_BUFFER_SIZE];
  //     snprintf(heartbeatTopic, sizeof(heartbeatTopic), "%s/heartbeat", MERCHANT_ID);
  //     mqtt.publish(heartbeatTopic, "alive");
  // }

  // Give other tasks time to run
  delay(10);
}