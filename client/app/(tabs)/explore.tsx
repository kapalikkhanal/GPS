import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../utils/supabase'; // Adjust the import path to your Supabase configuration
import { CommonActions } from '@react-navigation/native';

const SettingsScreen = ({ navigation }) => {
  // Default settings state
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    soundEffects: true,
    privacyMode: false
  });

  // Toggle function for settings switches
  const toggleSetting = (setting) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [setting]: !prevSettings[setting]
    }));
  };

  // Logout function
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        Alert.alert('Logout Error', error.message);
        return;
      }
      
      // Use CommonActions to navigate to Login screen
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }]
        })
      );
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Unable to log out. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      {/* Notifications Setting */}
      <View style={styles.settingRow}>
        <Text>Notifications</Text>
        <Switch
          value={settings.notifications}
          onValueChange={() => toggleSetting('notifications')}
        />
      </View>

      {/* Dark Mode Setting */}
      <View style={styles.settingRow}>
        <Text>Dark Mode</Text>
        <Switch
          value={settings.darkMode}
          onValueChange={() => toggleSetting('darkMode')}
        />
      </View>

      {/* Sound Effects Setting */}
      <View style={styles.settingRow}>
        <Text>Sound Effects</Text>
        <Switch
          value={settings.soundEffects}
          onValueChange={() => toggleSetting('soundEffects')}
        />
      </View>

      {/* Privacy Mode Setting */}
      <View style={styles.settingRow}>
        <Text>Privacy Mode</Text>
        <Switch
          value={settings.privacyMode}
          onValueChange={() => toggleSetting('privacyMode')}
        />
      </View>

      {/* Logout Button */}
      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#FF6347',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold'
  }
});

export default SettingsScreen;