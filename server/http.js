// server.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});