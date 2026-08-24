const { app, BrowserWindow, Menu, shell, dialog, session } = require('electron');
const path = require('path');

const APP_URL = 'https://adcmoveiseletro.com.br/login';
const APP_ORIGIN = 'https://adcmoveiseletro.com.br';

let mainWindow;

function createMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { label: 'Sair', role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'resetZoom', label: 'Zoom Padrão' },
        { role: 'zoomIn', label: 'Aumentar Zoom' },
        { role: 'zoomOut', label: 'Diminuir Zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' },
        { type: 'separator' },
        { label: 'Ferramentas do Desenvolvedor', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function isSameOrigin(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  const ses = session.fromPartition('persist:adcerp');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'ADC ERP',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(APP_URL);

  // Links pra fora do sistema (WhatsApp, etc.) abrem no navegador padrão.
  // Links do mesmo site (ex: carnê em nova janela) abrem dentro do app,
  // compartilhando a mesma sessão de login.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSameOrigin(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false },
          autoHideMenuBar: true,
          icon: path.join(__dirname, 'build', 'icon.png'),
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isSameOrigin(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Downloads (exportar CSV/backup, etc.) pedem onde salvar.
  ses.on('will-download', (event, item) => {
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    });
    if (savePath) {
      item.setSavePath(savePath);
    } else {
      item.cancel();
    }
  });

  // Menu de contexto simples (recortar/copiar/colar) em qualquer campo de texto.
  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const menu = Menu.buildFromTemplate([
      { label: 'Recortar', role: 'cut', enabled: params.isEditable },
      { label: 'Copiar', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Colar', role: 'paste', enabled: params.isEditable },
      { type: 'separator' },
      { label: 'Selecionar Tudo', role: 'selectAll' },
    ]);
    menu.popup();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
