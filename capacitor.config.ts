import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.onionring.app',
  appName: 'Onion Ring',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Camera: {
      saveToGallery: false,
    },
    SplashScreen: {
      launchShowDuration: 500,
    },
  },
}

export default config
