import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native'
import { supabase } from '../utils/supabase'
import axios from 'axios'
import { Feather, MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft
} from 'react-native-reanimated'

// Screen dimensions
const { width, height } = Dimensions.get('window')

// Define Vehicle interface
interface Vehicle {
  id: string
  device_id: string
  name: string
  status: string
  user_id: string
  last_location: null | any
  last_updated: null | string
  created_at: string
  updated_at: string
}

// Color Palette
const COLORS = {
  primary: '#4A6CF7',
  secondary: '#6A7BA2',
  background: '#F4F7FE',
  text: '#2C3E50',
  white: '#FFFFFF',
  gray: '#A0AEC0',
  success: '#48BB78',
  danger: '#F56565'
}

export default function DashboardScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [gpsCode, setGpsCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchVehicles()
  }, [])

  const fetchVehicles = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    console.log("Logged in User ID:", user?.id)
    try {
      const response = await axios.get(`http://192.168.101.10:3001/api/vehicles/${user?.id}`)
      console.log("Raw Response Data:", response.data)
      console.log("Number of Vehicles:", response.data.length)

      // Add type checking
      const validVehicles = response.data.filter((vehicle: { id: any; name: any; device_id: any }) =>
        vehicle.id && vehicle.name && vehicle.device_id
      );

      console.log("Valid Vehicles:", validVehicles);

      setVehicles(validVehicles)
    } catch (error) {
      // console.error('Detailed Error fetching vehicles:', error.response ? error.response.data : error.message)
      Alert.alert('Error', 'Could not fetch vehicles')
    } finally {
      setLoading(false)
    }
  }

  const handleAddVehicle = async () => {
    if (!vehicleNumber || !gpsCode) {
      Alert.alert('Validation Error', 'Please fill all fields')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      await axios.post('http://192.168.101.10:3001/api/vehicles', {
        userId: user?.id,
        vehicleNumber,
        gpsCode
      })

      setIsModalVisible(false)
      setVehicleNumber('')
      setGpsCode('')
      fetchVehicles()

      Alert.alert('Success', 'Vehicle added successfully')
    } catch (error) {
      console.error('Error adding vehicle:', error)
      Alert.alert('Error', 'Could not add vehicle')
    } finally {
      setLoading(false)
    }
  }

  const renderVehicleItem = ({ item }: { item: Vehicle }) => {
    console.log("Rendering Vehicle Item:", JSON.stringify(item));

    if (!item || !item.id) {
      console.log('Invalid vehicle item:', item);
      return null;
    }

    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'active': return COLORS.success
        case 'inactive': return COLORS.danger
        default: return COLORS.secondary
      }
    }

    return (
      <Animated.View
        entering={SlideInRight}
        exiting={SlideOutLeft}
        style={styles.vehicleCard}
      >
        <TouchableOpacity
          onPress={() => router.push({
            pathname: "/track",
            params: {
              vehicleId: item.id,
              vehicleName: item.name,
              deviceId: item.device_id
            }
          })}
        >
          <View style={styles.cardContent}>
            <View style={styles.vehicleDetails}>
              <Text style={styles.vehicleNumber}>{item.name}</Text>
              <Text style={styles.gpsDetails}>Device ID: {item.device_id}</Text>
              <Text style={styles.createdAt}>
                Added: {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(item.status) }
            ]} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <LinearGradient
        colors={[COLORS.background, COLORS.white]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Fleet</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalVisible(true)}
        >
          <MaterialIcons name="add" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        data={vehicles}
        renderItem={renderVehicleItem}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        contentContainerStyle={styles.listContent}

        // Add these diagnostic props
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={21}

        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>No vehicles found. Debug info:</Text>
            <Text>Vehicles array length: {vehicles.length}</Text>
            <Text>Vehicles data: {JSON.stringify(vehicles)}</Text>
          </View>
        }

        refreshing={loading}
        onRefresh={fetchVehicles}
      />
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={SlideInRight}
            exiting={SlideOutLeft}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Add New Vehicle</Text>


            <TextInput
              style={styles.input}
              placeholder="Vehicle Number"
              placeholderTextColor={COLORS.gray}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />

            <TextInput
              style={styles.input}
              placeholder="GPS Device Code"
              placeholderTextColor={COLORS.gray}
              value={gpsCode}
              onChangeText={setGpsCode}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  loading && styles.disabledButton
                ]}
                onPress={handleAddVehicle}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Adding...' : 'Add Vehicle'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  listContent: {
    paddingVertical: 15,
  },
  vehicleCard: {
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  gpsDetails: {
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 5,
  },
  createdAt: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 5,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.2,
  },
  emptyStateText: {
    fontSize: 18,
    color: COLORS.secondary,
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.gray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: COLORS.background,
    fontSize: 16,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
    padding: 15,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 15,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
})