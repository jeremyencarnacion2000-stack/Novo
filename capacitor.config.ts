import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novo.productivity',
  appName: 'Productivity By Novo',
  webDir: 'out',
  android: {
    allowMixedContent: true,
    // Override user agent so Google OAuth doesn't detect WebView and block login
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  },
};

export default config;
