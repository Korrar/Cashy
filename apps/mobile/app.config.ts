import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Spendr',
  slug: 'spendr',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0B',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.spendr.mobile',
    infoPlist: {
      UIBackgroundModes: ['fetch', 'remote-notification'],
    },
  },
  android: {
    package: 'app.spendr.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0B',
    },
    permissions: ['RECEIVE_BOOT_COMPLETED', 'VIBRATE'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#8B6914',
      },
    ],
  ],
  scheme: 'spendr',
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
}

export default config
