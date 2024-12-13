import React, { useState, useEffect, useCallback } from 'react'
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
  StatusBar,
  Image,
  KeyboardAvoidingView
} from 'react-native'
import { supabase } from '../utils/supabase'
import axios from 'axios'
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

// Screen dimensions
const { width, height } = Dimensions.get('window')

// Enhanced Color Palette
const COLORS = {
  primary: '#4A6CF7',
  secondary: '#6A7BA2',
  background: '#F4F7FE',
  text: '#2C3E50',
  white: '#FFFFFF',
  gray: '#A0AEC0',
  lightGray: '#F9FAFB',
  success: '#48BB78',
  danger: '#F56565',
  accent: '#5E81AC'
}

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

export default function DashboardScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [userId, setUserId] = useState('')
  const [gpsCode, setGpsCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    }
  })

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        setUserId(user.id); // Correctly setting the user ID
      }
      const response = await axios.get(`https://gps-7qjm.onrender.com/api/vehicles/${user?.id}`)

      const validVehicles = response.data.filter((vehicle: Vehicle) =>
        vehicle.id && vehicle.name && vehicle.device_id
      )

      setVehicles(validVehicles)
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      setError('Could not fetch vehicles. Please check your connection.')
      Alert.alert('Error', 'Could not fetch vehicles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const handleAddVehicle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (!vehicleNumber || !gpsCode) {
      setError('Please fill all fields')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await axios.post('https://gps-7qjm.onrender.com/api/vehicles', {
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
      setError('Could not add vehicle. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const deleteVehicle = async (vehicleId: string, userId: string) => {
    try {
      const response = await axios.delete('https://gps-7qjm.onrender.com/api/vehicles/', {
        data: {
          vehicleNumber: vehicleId,
          userId,
        },
      });

      console.log(response.data.message);

      // Perform any additional actions upon successful deletion (e.g., refresh the list)
    } catch (error: any) {
      console.error('Error deleting vehicle:', error.response?.data?.error || error.message);
      // Handle the error appropriately (e.g., show an error message to the user)
    }
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => {
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
        style={[styles.vehicleCard, animatedStyle]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.push({
              pathname: "/track",
              params: {
                vehicleId: item.id,
                vehicleName: item.name,
                deviceId: item.device_id
              }
            })
          }}
          onPressIn={() => scale.value = withSpring(0.95)}
          onPressOut={() => scale.value = withSpring(1)}
        >
          <View style={styles.cardContent}>
            <View style={styles.vehicleDetails}>
              <Text style={styles.vehicleNumber}>{item.name}</Text>
              <Text style={styles.gpsDetails}>Device ID: {item.device_id}</Text>
              <Text style={styles.createdAt}>
                Added: {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
              <View style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(item.status) }
              ]} />
              <TouchableOpacity
                onPress={() => { deleteVehicle(item.device_id, userId) }}>
                <MaterialIcons name="delete" size={28} color={'red'} />
              </TouchableOpacity>
            </View>

          </View>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const EmptyStateComponent = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="car-outline"
        size={100}
        color={COLORS.secondary}
      />
      <Text style={styles.emptyStateText}>
        No vehicles tracked yet
      </Text>
      <Text style={styles.emptyStateSubtext}>
        Add a vehicle to start tracking
      </Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <LinearGradient
        colors={[COLORS.background, COLORS.lightGray]}
        style={styles.header}
      >
        <Image
          source={require('../../assets/icons/Stalker.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setIsModalVisible(true)
          }}
        >
          <MaterialIcons name="add" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        data={vehicles}
        renderItem={renderVehicleItem}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyStateComponent />}
        refreshing={loading}
        onRefresh={fetchVehicles}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.centeredModalView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.centeredModalView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Add New Vehicle</Text>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TextInput
                style={[
                  styles.input,
                  error && styles.inputError
                ]}
                placeholder="Vehicle Number"
                placeholderTextColor={COLORS.gray}
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
              />

              <TextInput
                style={[
                  styles.input,
                  error && styles.inputError
                ]}
                placeholder="GPS Device Code"
                placeholderTextColor={COLORS.gray}
                value={gpsCode}
                onChangeText={setGpsCode}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setIsModalVisible(false)
                  }}
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
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    position: 'relative'
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
    fontSize: 20,
    color: COLORS.text,
    marginTop: 15,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: COLORS.secondary,
    marginTop: 5,
  },
  centeredModalView: {
    position: 'absolute',
    zIndex: 1,
    height: height,
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
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
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: 500, // Add a max-width to prevent it from becoming too wide on larger screens
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
  inputError: {
    borderColor: COLORS.danger,
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
  errorContainer: {
    width: '100%',
    backgroundColor: COLORS.danger + '20', // Transparent red
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  errorText: {
    color: COLORS.danger,
    textAlign: 'center',
  },
  logo: {
    width: 150,
    height: 50,
    alignSelf: 'center',
  },
})