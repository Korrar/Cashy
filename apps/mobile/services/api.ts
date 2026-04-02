import axios from 'axios'
import Constants from 'expo-constants'
import { MMKV } from 'react-native-mmkv'

export const storage = new MMKV({ id: 'spendr-storage' })

const BASE_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = storage.getString('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      storage.delete('auth_token')
      storage.delete('auth_user')
    }
    return Promise.reject(err)
  },
)
