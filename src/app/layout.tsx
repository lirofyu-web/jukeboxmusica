
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { MachineProvider } from '@/components/machine-provider';

export const metadata: Metadata = {
  title: 'JUKEBOX MONTANHA',
  description: 'A classic retro jukebox experience.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JUKEBOX MONTANHA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('Offline ServiceWorker pronto.');
                  }).catch(function(err) {
                    console.log('Erro ServiceWorker:', err);
                  });
                });
              }
              
              // Patch de Performance para Android TV / Capacitor
              (function() {
                var ua = navigator.userAgent.toLowerCase();
                var isAndroid = ua.indexOf("android") > -1;
                var isCapacitor = !!window.Capacitor;
                
                if (isAndroid || isCapacitor) {
                  document.documentElement.classList.add('android-tv-mode');
                  console.log('Modo de Alta Performance Ativado para Android TV');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-white selection:bg-primary/30" suppressHydrationWarning>
        <FirebaseClientProvider>
          <MachineProvider>
            <div suppressHydrationWarning className="min-h-screen">
              {children}
            </div>
          </MachineProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
