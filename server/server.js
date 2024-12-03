const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');

const app = express();
const port = 80; // HTTP port

// Middleware to parse incoming JSON bodies
app.use(bodyParser.json());

// POST endpoint to receive GPS data
app.post('/api/gpsdata', (req, res) => {
    const { lat, lng } = req.body;
    console.log("Received data:", req.body);
    
    // Check if lat and lng are present
    if (lat && lng) {
        console.log(`Received GPS Data: Latitude = ${lat}, Longitude = ${lng}`);
        return res.status(200).send({ status: 'success', message: 'Data received successfully.' });
    } else {
        console.log('Invalid data received.');
        return res.status(400).send({ status: 'error', message: 'Invalid data format.' });
    }
});

// Create and start the HTTP server
http.createServer(app).listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
