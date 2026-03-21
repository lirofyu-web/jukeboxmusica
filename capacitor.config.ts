import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jukebox.montanha',
  appName: 'JukeboxMontanha',
  webDir: 'out',
  server: {
    url: 'https://jukeboxmusica.vercel.app/',
    cleartext: true
  }
};


export default config;
