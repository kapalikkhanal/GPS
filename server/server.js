const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
