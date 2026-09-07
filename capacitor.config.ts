import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ee.hoimu.app',
  appName: 'HÕIMU',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
