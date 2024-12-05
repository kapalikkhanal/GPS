const mqtt = require('mqtt');

// Ably MQTT broker details
const host = 'mqtt.ably.io';
const port = 8883;
const username = 'yMJ3VQ.PxwimQ';
const password = 'Vw4oM1CCMxx0tm8xTIZtda72vNj3SmNkLbVPipSt5Ek';

// Merchant ID (same as ESP32's topic)
const merchantId = '005000827602524';
const topic = `${merchantId}/location`;

// Connect to the MQTT broker
const options = {
  username,
  password,
  protocol: 'mqtts', // Secure connection
  port,
};

const client = mqtt.connect(`mqtts://${host}`, options);

client.on('connect', () => {
  console.log('Connected to Ably MQTT broker');
  
  // Subscribe to the topic
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('Failed to subscribe:', err);
    } else {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });
});

// Handle incoming messages
client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log('Received data:', data);

    // Access latitude and longitude
    const { lat, lng } = data;
    console.log(`Latitude: ${lat}, Longitude: ${lng}`);

    // Process the received data as needed
    // For example, you could store it in a database, or perform real-time actions
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

// Handle errors
client.on('error', (err) => {
  console.error('MQTT error:', err);
});

client.on('close', () => {
  console.log('Connection to MQTT broker closed');
});
