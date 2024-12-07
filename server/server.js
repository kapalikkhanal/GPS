// server.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

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

const mqttClient = mqtt.connect(`mqtts://${host}`, options);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// WebSocket connection handling
const clients = new Map(); // Store client connections by device ID

wss.on('connection', (ws) => {
  let deviceId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Data", data)
      if (data.type === 'register') {
        // console.log("Data, Register", data.deviceId)
        deviceId = data.deviceId;
        clients.set(deviceId, ws);
        ws.send(JSON.stringify({ type: 'registered', deviceId }));
      } else if (data.type === 'location') {
        if (!deviceId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Device not registered' }));
          return;
        }

        try {
          console.log(deviceId)
          const { data: result, error } = await supabase.rpc('update_vehicle_location', {
            p_device_id: deviceId,
            p_latitude: data.latitude,
            p_longitude: data.longitude,
            p_speed: data.speed || null,
            p_heading: data.heading || null
          });

          if (error) {
            console.error('Supabase error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to update location' }));
            return;
          }

          if (result === 'Vehicle not found') {
            console.error('Vehicle not found:', deviceId);
            ws.send(JSON.stringify({ type: 'error', message: 'Vehicle not found' }));
            return;
          }

          ws.send(JSON.stringify({ type: 'success', message: 'Location updated' }));
        } catch (error) {
          console.error('Location update error:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to update location' }));
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (deviceId) {
      clients.delete(deviceId);
      updateVehicleStatus(deviceId, 'offline');
    }
  });
});

mqttClient.on('connect', () => {
  console.log('Connected to Ably MQTT broker');

  // Subscribe to the topic
  mqttClient.subscribe(topic, (err) => {
    if (err) {
      console.error('Failed to subscribe:', err);
    } else {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });
});

// MQTT message handler
mqttClient.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log('Received data:', data);

    const { lat, lng, speed, sat, id, timestamp } = data;

    if (!id || !lat || !lng) {
      console.error('Missing required fields (id, lat, or lng)');
      return;
    }

    // First, check if the vehicle exists
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('device_id', id)
      .single();

    if (vehicleError || !vehicle) {
      console.error('Vehicle not found:', id);
      return;
    }

    // Check if a location record exists for this vehicle
    const { data: existingLocation, error: locationError } = await supabase
      .from('vehicle_locations')
      .select('id')
      .eq('vehicle_id', vehicle.id)
      .single();

    let result;

    if (existingLocation) {
      // Update existing record
      result = await supabase
        .from('vehicle_locations')
        .update({
          location: `(${lng},${lat})`, // Point format for PostgreSQL
          speed: speed || null,
          heading: data.heading || null,
          timestamp: timestamp || new Date().toISOString()
        })
        .eq('id', existingLocation.id);
    } else {
      // Insert new record
      result = await supabase
        .from('vehicle_locations')
        .insert({
          vehicle_id: vehicle.id,
          location: `(${lng},${lat})`,
          speed: speed || null,
          heading: data.heading || null,
          timestamp: timestamp || new Date().toISOString()
        });
    }

    // Also update the vehicles table with last known location
    await supabase
      .from('vehicles')
      .update({
        last_location: `(${lng},${lat})`,
        last_updated: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', vehicle.id);

    if (result.error) {
      console.error('Error updating location:', result.error);
    } else {
      console.log('Location updated successfully');
    }

  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Handle errors
mqttClient.on('error', (err) => {
  console.error('MQTT error:', err);
});

mqttClient.on('close', () => {
  console.log('Connection to MQTT broker closed');
});

// API Routes
app.post('/api/vehicles', async (req, res) => {
  try {
    const { userId, vehicleNumber, gpsCode } = req.body;
    console.log('Request Body:', req.body);

    // Additional debugging steps
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Authenticated User:', user);

    const { data, error } = await supabase
      .from('vehicles')
      .insert([{
        user_id: userId, // Use authenticated user's ID
        name: vehicleNumber,
        device_id: gpsCode
      }]);

    if (error) {
      console.error('Supabase Insert Error:', error);
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Full Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehicles', async (req, res) => {
  try {
    const { vehicleNumber, userId } = req.body;

    console.log(req.body)
    // Fetch the vehicle's ID to ensure it's associated with the user
    const { data: vehicle, error: fetchError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('device_id', vehicleNumber)
      .eq('user_id', userId)
      .single();

    console.log(vehicle)

    if (fetchError || !vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Delete related records in vehicle_locations
    const { error: deleteLocationsError } = await supabase
      .from('vehicle_locations')
      .delete()
      .eq('vehicle_id', vehicle.id);

    if (deleteLocationsError) {
      console.error('Error deleting related records:', deleteLocationsError);
      return res.status(500).json({ error: deleteLocationsError.message });
    }

    // Delete the vehicle
    const { error: deleteVehicleError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicle.id);

    if (deleteVehicleError) {
      console.error('Error deleting vehicle:', deleteVehicleError);
      return res.status(500).json({ error: deleteVehicleError.message });
    }

    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Full Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicle_locations/:vehicleId', async (req, res) => {
  try {
    console.log(req.params.vehicleId)
    const { data, error } = await supabase
      .from('vehicle_locations')
      .select('*')
      .eq('vehicle_id', req.params.vehicleId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ message: 'No location found for this vehicle' });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Error fetching latest vehicle location:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicles/:userId', async (req, res) => {
  console.log("Getting vehicles for user:", req.params.userId);
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', req.params.userId);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to handle GPS data
app.post('/api/gpsdata', (req, res) => {
  const { lat, lng } = req.body;
  console.log("data::", req.body)
  if (lat && lng) {
    console.log(`Received GPS Data: Latitude = ${lat}, Longitude = ${lng}`);
    res.status(200).send({ status: 'success', message: 'Data received successfully.' });
  } else {
    console.log('Invalid data received.');
    res.status(400).send({ status: 'error', message: 'Invalid data format.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    res.json({ message: "Server working well." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update vehicle status
async function updateVehicleStatus(deviceId, status) {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ status: status })
      .eq('device_id', deviceId);

    if (error) {
      console.error('Failed to update vehicle status:', error);
    }
  } catch (error) {
    console.error('Status update error:', error);
  }
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});