const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
app.name = 'Biobridge Editor';

const oceDir = path.join(os.homedir(), 'Documents', 'OCE');
const extensionsDir = path.join(oceDir, 'Extensions');
const configDir = path.join(oceDir, 'Config');

function ensureOceDirectory() {
    if (!fs.existsSync(oceDir)) {
        fs.mkdirSync(oceDir);
    }
    if (!fs.existsSync(extensionsDir)) {
        fs.mkdirSync(extensionsDir);
    }
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir);
    }
}

let mainWindow;

// Function to create the main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1450,
        height: 1000,
        webPreferences: {
            contextIsolation: false,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
        }
    });

    mainWindow.loadFile('main.html');

    // Check for command-line arguments after the window is created
    const args = process.argv.slice(2); // Skip the first argument (path to electron)
    if (args.length > 0) {
        const filePath = args[0];
        openFile(filePath);
    }
}

function openFile(filePath) {
    // Send the file path to the renderer process
    if (mainWindow) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('file-selected', filePath);
        });
    }
}

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// When the app is ready
app.whenReady().then(() => {
    ensureOceDirectory();
    createWindow();

    const menuTemplate = [
        {
            label: 'Okral Code Editor',
            submenu: [
                {
                    label: 'Select Extensions Directory',
                    click: selectExtensionsDirectory
                },
                {
                    label: 'Quit',
                    role: 'quit'
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'copy' },
                { role: 'paste' },
                { role: 'undo' },
                { role: 'redo' },
                { role: 'cut' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'togglefullscreen' },
                { role: 'toggleDevTools' },
                { role: 'minimize'}
            ]
        },
        {
            label: 'Zoom',
            submenu: [
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
            ]
        },
        {
            label: 'Help',
            submenu: [
                { role: 'about' },
                {
                    label: 'Wiki/Help',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/Okerew/okraleditor/wiki');
                    }
                },
                {
                    label: 'Keybinds',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/Okerew/okraleditor/wiki/Keybinds');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
});

function selectExtensionsDirectory() {
    dialog.showOpenDialog({
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            const selectedDirectory = result.filePaths[0];
            loadExtensions(selectedDirectory);
        } else {
            console.log('Extension directory selection canceled.');
        }
    }).catch(error => {
        console.error('Error selecting extension directory:', error);
    });
}

// IPC function to open folder selection dialog
ipcMain.on('open-folder-dialog', (event) => {
    dialog.showOpenDialog({
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            event.reply('selected-folder', result.filePaths[0]);
        }
    }).catch(err => {
        console.error(err);
    });
});

ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog({
        properties: ['openFile']
    }).then(result => {
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            event.sender.send('file-selected', filePath);
        }
    }).catch(err => {
        console.log(err);
    });
});

ipcMain.on('rename-file', (event, filePath) => {
    const dir = path.dirname(filePath);
    const oldName = path.basename(filePath);

    dialog.showSaveDialog(mainWindow, {
        title: 'Rename File',
        defaultPath: filePath,
        buttonLabel: 'Rename'
    }).then(result => {
        if (result.canceled || !result.filePath) {
            mainWindow.webContents.send('rename-complete', false, 'Rename cancelled');
            return;
        }

        const newName = path.basename(result.filePath);
        if (newName === oldName) {
            mainWindow.webContents.send('rename-complete', false, 'Same name provided, no changes made');
            return;
        }

        const newPath = path.join(dir, newName);
        fs.rename(filePath, newPath, (err) => {
            if (err) {
                mainWindow.webContents.send('rename-complete', false, err.message);
            } else {
                mainWindow.webContents.send('rename-complete', true);
            }
        });
    }).catch(err => {
        mainWindow.webContents.send('rename-complete', false, err.message);
    });
});

ipcMain.handle('select-folder-location', async () => {
    // Open a dialog to select folder location
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Location for New Folder',
        properties: ['openDirectory']
    });

    if (filePaths && filePaths.length > 0) {
        return { success: true, folderPath: filePaths[0] };
    }
    return { success: false, message: 'No folder selected' };
});

ipcMain.handle('create-new-folder', (event, folderPath, folderName) => {
    const newFolderPath = path.join(folderPath, folderName);

    // Check if folder already exists
    if (!fs.existsSync(newFolderPath)) {
        fs.mkdirSync(newFolderPath);
        return { success: true, folderPath: newFolderPath };
    } else {
        return { success: false, message: 'Folder already exists' };
    }
});
