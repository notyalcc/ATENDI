import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const PORT = 3000;

let serverInstance = null;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startServer() {
  if (serverInstance) return;

  const server = express();
  // app.getAppPath() é o método mais seguro para localizar a pasta 'dist' dentro do executável empacotado
  const distPath = path.join(app.getAppPath(), 'dist');
  
  // Serve os arquivos estáticos da pasta dist
  server.use(express.static(distPath));

  // Garante que qualquer rota digitada no navegador carregue o index.html (evita erros 404)
  server.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  serverInstance = server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na rede em http://0.0.0.0:${PORT}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), // Use um preload script para expor APIs se necessário
    },
  });

  // Intercepta a abertura de novas janelas (links com target="_blank")
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // (Opcional) Intercepta navegações que tentem sair do app na mesma janela
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL() && url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const localIp = getLocalIp();

  if (isDev) {
    win.loadURL(`http://localhost:3000?ip=${localIp}`); // Carrega o servidor de desenvolvimento do Vite
    win.webContents.openDevTools();
  } else {
    win.loadURL(`http://localhost:${PORT}?ip=${localIp}`);
  }
}

app.whenReady().then(() => {
  // Iniciamos o servidor antes de criar a janela para garantir que a URL esteja disponível
  if (!isDev) startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});