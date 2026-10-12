import type { CapacitorConfig } from '@capacitor/cli';

const defaultAppUrl = 'https://productivitynovo.vercel.app/app';
const configuredAppUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const serverUrl = (() => {
  if (!configuredAppUrl) return defaultAppUrl;
  try {
    const candidate = new URL(configuredAppUrl);
    const isSecure = candidate.protocol === 'https:';
    const isAppSurface = /^\/app\/?$/.test(candidate.pathname);
    return isSecure && isAppSurface ? candidate.toString().replace(/\/$/, '') : defaultAppUrl;
  } catch {
    return defaultAppUrl;
  }
})();

const config: CapacitorConfig = {
  appId: 'com.novo.productivity',
  appName: 'Productivity By Novo',
  // Native shells open the app resolver directly. The resolver sends new
  // users through web login/onboarding and returning users into the product.
  // The public landing remains a web-only acquisition surface; auth and API
  // state stay on the deployed Novo origin so OAuth callbacks are global.
  // Keep a tiny app-only fallback bundle for `cap copy`; runtime still uses
  // server.url below, so the public landing is never packaged in the shell.
  webDir: 'native-shell',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
