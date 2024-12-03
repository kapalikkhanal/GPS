import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';

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
  // console.log(vehicleId)

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [position, setPosition] = useState<VehiclePosition | null>(null);

  // Function to fetch vehicle location
  const fetchVehicleLocation = async () => {
    try {
      const response = await fetch(`http://192.168.101.10:3001/api/vehicle_locations/${vehicleId}`);

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

      setPosition(newPosition);
      setError(null);
      generateMapHTML();
    } catch (err) {
      console.error('Error fetching vehicle location:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle reload
  const handleReload = () => {
    setKey(prevKey => prevKey + 1);
    setIsLoading(true);
    setError(null);
  };

  // Setup interval for fetching location
  useEffect(() => {
    // Fetch immediately on mount
    fetchVehicleLocation();

    // Set up interval to fetch every 3 seconds
    const intervalId = setInterval(fetchVehicleLocation, 7000);

    // Cleanup interval on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [deviceId]);

  useEffect(() => {
    handleReload();
  }, [position])

  const generateMapHTML = () => {
    if (!position) return '';

    const safeVehicleName = vehicleName || 'Unknown Vehicle';
    const safeSpeed = position.speed?.toFixed(2) || '0';
    const safeTimestamp = position.timestamp ? new Date(position.timestamp).toLocaleString() : 'Unknown';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
          <meta http-equiv="Pragma" content="no-cache" />
          <meta http-equiv="Expires" content="0" />
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
          <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              width: 100%; 
              height: 100%; 
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
            // Immediately initialize map without waiting for DOMContentLoaded
            try {
              const map = L.map('map').setView([${position.latitude}, ${position.longitude}], 15);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                noCache: true,
                timestamp: new Date().getTime()
              }).addTo(map);

              const marker = L.marker([${position.latitude}, ${position.longitude}])
                .addTo(map)
                .bindPopup(
                  '<b>${safeVehicleName}</b><br>' +
                  'Speed: ${safeSpeed} km/h<br>' +
                  'Last Updated: ${safeTimestamp}'
                )
                .openPopup();

              // Force map to refresh
              setTimeout(() => {
                map.invalidateSize();
                window.ReactNativeWebView.postMessage('Map loaded successfully');
              }, 100);
            } catch (e) {
              window.ReactNativeWebView.postMessage('Error: ' + e.message);
            }
          </script>
        </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : position ? (
        <WebView
          key={key}
          source={{ html: generateMapHTML() }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          cacheEnabled={false}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
            setError('Failed to load map');
          }}
          onMessage={(event) => {
            if (event.nativeEvent.data.startsWith('Error:')) {
              setError(event.nativeEvent.data);
              handleReload();
            }
          }}
        />
      ) : null}
      {isLoading && (
        <View style={[styles.centerContainer, styles.loadingOverlay]}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginHorizontal: 20,
  },
});