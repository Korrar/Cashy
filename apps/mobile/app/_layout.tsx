import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '../store/authStore'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { registerBackgroundSync } from '../tasks/backgroundSync'

export default function RootLayout() {
  const router   = useRouter()
  const segments = useSegments()
  const { token, hydrate } = useAuthStore()

  usePushNotifications()

  useEffect(() => {
    hydrate()
    registerBackgroundSync()
  }, [])

  useEffect(() => {
    const inAuth = segments[0] === 'auth'
    if (!token && !inAuth) {
      router.replace('/auth/login')
    } else if (token && inAuth) {
      router.replace('/tabs')
    }
  }, [token, segments])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="tabs" />
        <Stack.Screen
          name="transaction/new"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
    </>
  )
}
