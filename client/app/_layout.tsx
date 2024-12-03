import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession()
  }, [])

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#f5f5f5' },
        headerShown: false,
        headerTintColor: '#000',
        headerBackTitle: 'Back'
      }}
    />
  )
}