import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { useTransactionsStore } from '../store/transactionsStore'
import { useDrSpenderStore } from '../store/drSpenderStore'
import { useStatsStore } from '../store/statsStore'

export const BACKGROUND_SYNC_TASK = 'spendr-background-sync'

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await Promise.all([
      useTransactionsStore.getState().fetch(true),
      useDrSpenderStore.getState().fetchComments(),
      useStatsStore.getState().fetchMonthly(),
    ])
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

export async function registerBackgroundSync() {
  const status = await BackgroundFetch.getStatusAsync()
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60,  // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    })
  }
}
