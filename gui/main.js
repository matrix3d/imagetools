const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const splitAtlas = require('../image.js');

// Fix path for pngquant-bin in production
const fixPath = () => {
    if (app.isPackaged) {
        const pngquantPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'pngquant-bin', 'vendor', 'pngquant.exe');
        // We might need to set this environment variable or mock the require if the library supports it.
        // However, pngquant-bin usually looks relative to its own file.
        // Let's try to help it find the binary if it's failing.
    }
};
fixPath();

let previewWindow = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    // Create Menu
    const template = [
        {
            label: 'File',
            submenu: [
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Visit Website',
                    click: async () => {
                        await shell.openExternal('https://matrix3d.github.io/');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createPreviewWindow() {
    if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.focus();
        return previewWindow;
    }

    previewWindow = new BrowserWindow({
        width: 600,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    previewWindow.loadFile(path.join(__dirname, 'preview.html'));

    previewWindow.on('closed', () => {
        previewWindow = null;
    });

    return previewWindow;
}

ipcMain.on('open-preview-window', (event, { dataUrl }) => {
    const win = createPreviewWindow();
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('set-image', dataUrl);
    });
});

ipcMain.on('update-preview-filter', (event, { h, s, v }) => {
    if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.webContents.send('set-filter', { h, s, v });
    }
});

ipcMain.handle('split-atlas', async (event, { filePath, outputDir, gap }) => {
    console.log('Main process received split-atlas request:', filePath);
    try {
        await splitAtlas(filePath, outputDir, gap, (msg) => {
            console.log('Progress:', msg);
            event.sender.send('split-progress', msg);
        });
        console.log('Split atlas completed successfully');
        return { success: true };
    } catch (err) {
        console.error('Error in split-atlas handler:', err);
        return { success: false, error: err.message };
    }
});

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
