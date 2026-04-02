import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useDrSpenderStore } from '../store/drSpenderStore'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:   true,
    shouldPlaySound:   true,
    shouldSetBadge:    true,
  }),
})

export function usePushNotifications() {
  const router        = useRouter()
  const responseRef   = useRef<Notifications.Subscription>()
  const { fetchComments, fetchSuggestions } = useDrSpenderStore()

  useEffect(() => {
    responseRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>

      // Refresh comments when a push arrives
      fetchComments()
      fetchSuggestions()

      if (data?.transactionId) {
        router.push(`/transaction/${data.transactionId}`)
      } else {
        router.push('/tabs/feed')
      }
    })

    return () => {
      responseRef.current?.remove()
    }
  }, [])
}
