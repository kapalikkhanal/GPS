// lib/supabase.tsx
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://dbkwuuioczanfcrnkluj.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRia3d1dWlvY3phbmZjcm5rbHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxMjI4NzQsImV4cCI6MjA0ODY5ODg3NH0.8NxUCb5DYYh8PbyCCCVQ2BzlNasrMS1nvFSZacMJ4ZI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})