import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';

// Screen dimensions
const { width, height } = Dimensions.get('window');

// Color Palette
const COLORS = {
  primary: '#4A6CF7',
  background: '#F4F7FE',
  text: '#2C3E50',
  error: '#F56565',
  white: '#FFFFFF'
};

interface TrackParams {
  vehicleId: string;
  vehicleName: string;
  deviceId: string;
}

interface VehiclePosition {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
}

export default function Track() {
  const params = useLocalSearchParams<TrackParams>();
  const vehicleId = params.vehicleId;
  const vehicleName = params.vehicleName;
  const deviceId = params.deviceId;

  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<VehiclePosition | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Function to fetch vehicle location
  const fetchVehicleLocation = useCallback(async () => {
    try {
      const response = await fetch(`https://gps-7qjm.onrender.com/api/vehicle_locations/${vehicleId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch vehicle location');
      }

      const data = await response.json();

      // Parse location string 
      const [longitude, latitude] = data.location
        .replace(/[()]/g, '')  // Remove parentheses
        .split(',')
        .map(parseFloat);

      const newPosition: VehiclePosition = {
        latitude,
        longitude,
        timestamp: data.timestamp,
        speed: data.speed
      };

      // Update position and send update to WebView
      setPosition(newPosition);
      updateMapMarker(newPosition);
      setError(null);
    } catch (err) {
      console.error('Error fetching vehicle location:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  }, [vehicleId, vehicleName]);

  // Function to update marker via WebView
  const updateMapMarker = (newPosition: VehiclePosition) => {
    const safeVehicleName = vehicleName || 'Unknown Vehicle';
    const safeSpeed = newPosition.speed?.toFixed(2) || '0';
    const safeTimestamp = newPosition.timestamp
      ? new Date(newPosition.timestamp).toLocaleString()
      : 'Unknown';

    const updateScript = `
      if (window.updateMarker) {
        window.updateMarker(
          ${newPosition.latitude}, 
          ${newPosition.longitude}, 
          '${safeVehicleName}', 
          '${safeSpeed}', 
          '${safeTimestamp}'
        );
      }
    `;

    webViewRef.current?.injectJavaScript(updateScript);
  };

  // Setup interval for fetching location
  useEffect(() => {
    // Fetch immediately on mount
    fetchVehicleLocation();

    // Set up interval to fetch every 7 seconds
    const intervalId = setInterval(fetchVehicleLocation, 7000);

    // Cleanup interval on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchVehicleLocation]);

  // Generate initial HTML for WebView
  const generateMapHTML = () => {
    if (!position) return '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
          <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              width: 100%; 
              height: 100%; 
              overflow: hidden;
            }
            #map { 
              width: 100%; 
              height: 100%; 
              position: absolute; 
              top: 0; 
              left: 0; 
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            let map, marker;
            
            function initMap() {
              // Initialize map
              map = L.map('map').setView([${position.latitude}, ${position.longitude}], 15);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
              }).addTo(map);

              // Create initial marker
              marker = L.marker([${position.latitude}, ${position.longitude}])
                .addTo(map)
                .bindPopup(
                  '<b>${vehicleName || 'Unknown Vehicle'}</b><br>' +
                  'Speed: ${position.speed?.toFixed(2) || '0'} km/h<br>' +
                  'Last Updated: ${new Date(position.timestamp).toLocaleString()}'
                )
                .openPopup();
            }

            // Function to update marker position
            window.updateMarker = function(lat, lng, name, speed, timestamp) {
              if (marker) {
                marker.setLatLng([lat, lng]);
                marker.getPopup().setContent(
                  '<b>' + name + '</b><br>' +
                  'Speed: ' + speed + ' km/h<br>' +
                  'Last Updated: ' + timestamp
                );
                map.panTo([lat, lng]);
              }
            }

            // Initialize map when DOM is ready
            document.addEventListener('DOMContentLoaded', initMap);
            
            // Handle potential load issues
            window.onerror = function(message) {
              window.ReactNativeWebView.postMessage('Error: ' + message);
            }
          </script>
        </body>
      </html>
    `;
  };

  // Render
  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : position ? (
        <WebView
          ref={webViewRef}
          source={{ html: generateMapHTML() }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          cacheEnabled={false}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
            setError('Failed to load map');
          }}
          onMessage={(event) => {
            if (event.nativeEvent.data.startsWith('Error:')) {
              setError(event.nativeEvent.data);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginHorizontal: 20,
    fontSize: 16,
  },
});