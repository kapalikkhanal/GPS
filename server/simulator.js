// gps-simulator.js
const WebSocket = require('ws');
const readline = require('readline');

class GPSSimulator {
    constructor(serverUrl, deviceId) {
        this.serverUrl = serverUrl;
        this.deviceId = deviceId;
        this.ws = null;
        this.isConnected = false;
        this.currentLocation = {
            // Starting position (example: San Francisco)
            latitude: 27.65580,
            longitude: 85.33911,
            speed: 0,
            heading: 0
        };
        this.simulationInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        console.log(`Attempting to connect to ${this.serverUrl}...`);

        try {
            this.ws = new WebSocket(this.serverUrl, {
                handshakeTimeout: 5000, // 5 seconds timeout for initial connection
                rejectUnauthorized: false // Add this if you're using self-signed certificates
            });

            this.ws.on('open', () => {
                console.log('Successfully connected to server');
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Register the device
                const registerMessage = {
                    type: 'register',
                    deviceId: this.deviceId
                };
                console.log('Sending register message:', registerMessage);
                this.ws.send(JSON.stringify(registerMessage));
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log('Received message:', message);

                    if (message.type === 'registered') {
                        console.log('Device registered successfully with ID:', message.deviceId);
                        this.startSimulation();
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            this.ws.on('close', (code, reason) => {
                console.log(`Disconnected from server. Code: ${code}, Reason: ${reason}`);
                this.isConnected = false;
                this.handleReconnect();
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error.message);
                if (error.code === 'ECONNREFUSED') {
                    console.log('Connection refused. Is the server running on the correct port?');
                }
            });
        } catch (error) {
            console.error('Connection error:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.log('Max reconnection attempts reached. Please check the server and try again.');
        }
    }

    startSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }

        this.simulationInterval = setInterval(() => {
            this.updateLocation();
            this.sendLocationUpdate();
        }, 30000); // Send updates every 5 seconds

        console.log('Simulation started');
        this.printCommands();
    }

    updateLocation() {
        // Simulate small random movements
        const latChange = (Math.random() - 0.5) * 0.001; // About 100m max movement
        const lonChange = (Math.random() - 0.5) * 0.001;

        this.currentLocation.latitude += latChange;
        this.currentLocation.longitude += lonChange;
        this.currentLocation.speed = Math.random() * 60; // Random speed between 0-60 mph
        this.currentLocation.heading = Math.random() * 360; // Random heading 0-360 degrees
    }

    sendLocationUpdate() {
        if (!this.isConnected) {
            console.log('Not connected to server. Location update skipped.');
            return;
        }

        const locationUpdate = {
            type: 'location',
            ...this.currentLocation
        };

        try {
            this.ws.send(JSON.stringify(locationUpdate));
            console.log('Sent location update:', locationUpdate);
        } catch (error) {
            console.error('Error sending location update:', error);
        }
    }

    setLocation(latitude, longitude) {
        this.currentLocation.latitude = latitude;
        this.currentLocation.longitude = longitude;
        console.log('Location set to:', this.currentLocation);
    }

    printCommands() {
        console.log('\nAvailable commands:');
        console.log('1. set <latitude> <longitude> - Set specific location');
        console.log('2. stop - Stop simulation');
        console.log('3. start - Start/resume simulation');
        console.log('4. status - Check connection status');
        console.log('5. reconnect - Force reconnection attempt');
        console.log('6. exit - Exit simulator\n');
    }

    setupCommandInterface() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('line', (input) => {
            const [command, ...args] = input.trim().split(' ');

            switch (command.toLowerCase()) {
                case 'set':
                    if (args.length === 2) {
                        const lat = parseFloat(args[0]);
                        const lon = parseFloat(args[1]);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            this.setLocation(lat, lon);
                        } else {
                            console.log('Invalid coordinates');
                        }
                    } else {
                        console.log('Usage: set <latitude> <longitude>');
                    }
                    break;

                case 'stop':
                    if (this.simulationInterval) {
                        clearInterval(this.simulationInterval);
                        this.simulationInterval = null;
                        console.log('Simulation stopped');
                    }
                    break;

                case 'start':
                    this.startSimulation();
                    break;

                case 'status':
                    console.log('Connection status:', this.isConnected ? 'Connected' : 'Disconnected');
                    console.log('Current location:', this.currentLocation);
                    break;

                case 'reconnect':
                    console.log('Forcing reconnection...');
                    if (this.ws) {
                        this.ws.close();
                    }
                    this.reconnectAttempts = 0;
                    this.connect();
                    break;

                case 'exit':
                    console.log('Shutting down simulator...');
                    if (this.simulationInterval) {
                        clearInterval(this.simulationInterval);
                    }
                    if (this.ws) {
                        this.ws.close();
                    }
                    rl.close();
                    process.exit(0);
                    break;

                default:
                    console.log('Unknown command');
                    this.printCommands();
            }
        });
    }
}

// Usage
const serverUrl = 'ws://localhost:3001';
// const deviceId = 'SIM_' + Math.random().toString(36).substr(2, 9); // Generate random device ID
const deviceId = '1234'

console.log('Starting GPS Simulator');
console.log('Server URL:', serverUrl);
console.log('Device ID:', deviceId);

const simulator = new GPSSimulator(serverUrl, deviceId);
simulator.connect();
simulator.setupCommandInterface();