const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const serve = require('electron-serve');
const isDev = !app.isPackaged;

// Configurações do Hard Lock
const KEY_FILENAME = 'jukebox_admin.key';
const EXPECTED_SECRET = 'MONTAGNA_JUKEBOX_2026';

// Função para buscar a chave USB em caminhos comuns do Linux e Windows
function getUsbStatus() {
  const mountPoints = [
    process.cwd(), // Permite colocar a chave na pasta do projeto para testes
    '/media/pedro',
    '/media',
    '/run/media', 
  ];

  if (process.platform === 'win32') {
    'DEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(drive => {
      mountPoints.push(`${drive}:/`);
    });
  }

  let hardLockPresent = false;
  let updateDiskPresent = false;
  let linkCode = null;

  for (const base of mountPoints) {
    try {
      if (!fs.existsSync(base)) continue;
      
      const items = fs.readdirSync(base);
      for (const item of items) {
        const itemPath = path.join(base, item);
        
        // Verifica Chave Hard Lock
        const keyPath = path.join(itemPath, KEY_FILENAME);
        const directKeyPath = path.join(base, KEY_FILENAME);
        const finalKeyPath = fs.existsSync(keyPath) ? keyPath : (fs.existsSync(directKeyPath) ? directKeyPath : null);

        if (finalKeyPath) {
          const content = fs.readFileSync(finalKeyPath, 'utf8');
          if (content.trim() === EXPECTED_SECRET) {
            hardLockPresent = true;
          }
        }

        // Verifica Código de Link (para associar máquina ao dono)
        const linkPath = path.join(itemPath, 'machine_link.txt');
        const directLinkPath = path.join(base, 'machine_link.txt');
        const finalLinkPath = fs.existsSync(linkPath) ? linkPath : (fs.existsSync(directLinkPath) ? directLinkPath : null);

        if (finalLinkPath) {
          try {
            const content = fs.readFileSync(finalLinkPath, 'utf8');
            linkCode = content.trim();
          } catch (e) {}
        }

        // Verifica se é pendrive de atualização (se tem pasta "musicas" ou "albuns")
        // No Linux itemPath pode ser /media/pedro/PENDRIVE
        if (fs.existsSync(itemPath) && fs.lstatSync(itemPath).isDirectory()) {
          const musicFolder = path.join(itemPath, 'musicas');
          const albumsFolder = path.join(itemPath, 'albuns');
          if (fs.existsSync(musicFolder) || fs.existsSync(albumsFolder)) {
            updateDiskPresent = true;
          }
        }
      }
    } catch (e) {}
  }
  return { hardLockPresent, updateDiskPresent, linkCode };
}

// Função para obter o ID único da máquina (Hardware)
function getHardwareId() {
  try {
    if (process.platform === 'linux') {
      if (fs.existsSync('/etc/machine-id')) {
        return fs.readFileSync('/etc/machine-id', 'utf8').trim();
      }
      if (fs.existsSync('/var/lib/dbus/machine-id')) {
        return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
      }
    } else if (process.platform === 'win32') {
      // No Windows, poderíamos usar o registro, mas para simplicidade e 
      // para o Pedro (que usa Linux nas máquinas), o /etc/machine-id é o foco.
      // Fallback para Windows:
      return require('crypto').createHash('sha256').update(process.env.COMPUTERNAME || 'win-machine').digest('hex');
    }
  } catch (e) {}
  return 'machine-' + Math.random().toString(36).substr(2, 9);
}

// Escuta pedidos do frontend
ipcMain.handle('check-hard-lock', async () => {
  return getUsbStatus();
});

ipcMain.handle('get-machine-id', async () => {
  return getHardwareId();
});

ipcMain.handle('get-wifi-networks', async () => {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') {
      return resolve([{ ssid: 'Demo-WiFi-1', signal: 80, security: 'WPA2' }, { ssid: 'Demo-WiFi-2', signal: 50, security: 'WPA2' }]);
    }
    
    // Lista redes usando nmcli
    // Formato: SSID:SIGNAL:SECURITY
    require('child_process').exec('nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list', (err, stdout) => {
      if (err) return resolve([]);
      const networks = stdout.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          const [ssid, signal, security] = line.split(':');
          return { ssid, signal: parseInt(signal), security };
        })
        .filter(n => n.ssid !== '--'); // Remove redes sem SSID
      resolve(networks);
    });
  });
});

ipcMain.handle('connect-wifi', async (event, { ssid, password }) => {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') {
      console.log(`Simulando conexão no Windows: ${ssid}`);
      return setTimeout(() => resolve({ success: true }), 2000);
    }

    const cmd = `nmcli dev wifi connect "${ssid}" password "${password}"`;
    require('child_process').exec(cmd, (err, stdout) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, message: stdout });
      }
    });
  });
});

// Handle ESM vs CommonJS
const serveDir = typeof serve === 'function' ? serve : serve.default;
const loadURL = serveDir({ directory: 'out' });

function createWindow() {
  const isKiosk = process.argv.includes('--kiosk');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    kiosk: isKiosk,
    alwaysOnTop: isKiosk,
    frame: !isKiosk,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Necessário para carregar arquivos locais e fazer requisições de PIX
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
  });

  // Habilitar som automaticamente
  win.webContents.audioMuted = false;

  if (isDev) {
    win.loadURL('http://localhost:9002');
  } else {
    loadURL(win);
  }

  // DevTools apenas em modo desenvolvimento — nunca no build final
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Configuração global para liberar mídia sem clique do usuário
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'AutoplayIgnoreWebAudio');

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
