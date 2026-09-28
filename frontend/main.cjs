const { app, BrowserWindow } = require('electron');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: __dirname + '/public/icons/app-icon-512.png', // Ensure you have an icon here
    webPreferences: {
      nodeIntegration: false
    }
  });

  // Point the desktop app to your live production frontend
  win.loadURL('https://talenzo.ipcsglobal.info/');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});