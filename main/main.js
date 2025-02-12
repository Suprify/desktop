const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const serve = require('electron-serve');
const path = require('path');
const os = require('os');
const fs = require('fs');
const snmp = require('net-snmp');
const { exec } = require('child_process');
const { machineId } = require('node-machine-id');
const crypto = require('crypto');

const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/local');
const configPath = path.join(appDataPath, 'printers-data-manager', 'config.json');
const logFilePath = path.join(appDataPath, 'printers-data-manager', 'app.log');

async function getMachineUUID() {
    const uuid = await machineId();
    return uuid;
}

async function getMachineName() {
    return os.hostname();
}

async function generateAccessToken() {
    const uuid = await getMachineUUID();
    return crypto.createHash('sha256').update(uuid).digest('hex');
}

// Função para adicionar uma entrada de log
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
  
    // Anexa a mensagem ao arquivo de log
    fs.appendFile(logFilePath, logMessage, (err) => {
      if (err) {
        console.error('Erro ao escrever no arquivo de log:', err);
      }
    });
  }

// Uso da função para registrar informações
logToFile('Aplicativo iniciado.');

// Registrar erros
process.on('uncaughtException', (error) => {
  logToFile(`Exceção não capturada: ${error.message}`);
});

// Você também pode substituir o console.log padrão para que todas as saídas sejam registradas
const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(...args); // Mantém o log no console
  logToFile(args.join(' ')); // Adiciona log ao arquivo
};

// Faça o mesmo para console.error se desejar
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args); // Mantém o erro no console
  logToFile(`Error: ${args.join(' ')}`); // Adiciona erro ao arquivo de log
};  

const appServe = app.isPackaged ? serve({
    directory: path.join(__dirname, "../out")
  }) : null;

let mainWindow;
let tray;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1080,
        height: 880,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.removeMenu();

    if (app.isPackaged) {
        appServe(mainWindow).then(() => {
          mainWindow.loadURL("app://-");
        });
      } else {
        mainWindow.loadURL("http://localhost:3333");
        mainWindow.webContents.openDevTools();
        mainWindow.webContents.on("did-fail-load", (e, code, desc) => {
          mainWindow.webContents.reloadIgnoringCache();
        });
      }

    const packageJsonPath = path.join(app.getAppPath(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const appVersion = packageJson.version;
    const appAuthor = packageJson.author;

    mainWindow.webContents.on('did-finish-load', () => {
        const configDirectory = path.join(appDataPath, 'printers-data-manager');
        
        if (!fs.existsSync(configDirectory)) {
            fs.mkdirSync(configDirectory, { recursive: true });
        }
        
        if (!fs.existsSync(configPath)) {
            const defaultConfig = { clientId: 0 };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        }
        
        const config = fs.readFileSync(configPath, 'utf-8');
        mainWindow.webContents.send('config-data', JSON.parse(config));
        mainWindow.webContents.send('app-info', { version: appVersion, author: appAuthor });
    });

    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    tray = new Tray(path.join(__dirname, '../public/printer.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Configurações', icon: path.join(__dirname, '../public/settings.png'), click: () => openWindow() },
        { type: 'separator' },
        { label: 'Fechar', icon: path.join(__dirname, '../public/close.png'), click: () => app.quit() }
    ]);
    tray.setToolTip('Printers Data Manager');
    tray.setContextMenu(contextMenu);
}

function openWindow() {
    mainWindow.show();
}

// main.js
function getSnmpData(ip, oid, community) {
    return new Promise((resolve, reject) => {
        const session = snmp.createSession(ip, community);
        session.get([oid], (error, varbinds) => {
            if (error) {
                console.error(`Erro ao coletar dados SNMP para ${ip}: ${error}`);
                resolve(0); // Retorna 0 em caso de erro
            } else {
                if (snmp.isVarbindError(varbinds[0])) {
                    console.error(`Erro Varbind para ${ip}: ${snmp.varbindError(varbinds[0])}`);
                    resolve(0); // Retorna 0 em caso de erro Varbind
                } else {
                    const value = parseInt(varbinds[0].value.toString(), 10);
                    resolve(isNaN(value) ? 0 : value); // Retorna 0 se o valor não for um número
                }
            }
            session.close();
        });
    });
}

ipcMain.handle('get-snmp-data', async (event, ip, oid, community) => {
    return getSnmpData(ip, oid, community);
});

ipcMain.on('save-settings', (event, data) => {
    fs.writeFileSync(configPath, JSON.stringify({ clientId: data.client_id }));
    event.reply('settings-saved', { success: true });
});

ipcMain.handle('get-machine-name', async () => {
    return await getMachineName();
});

ipcMain.handle('generate-access-token', async () => {
    return await generateAccessToken();
});

app.on('ready', () => {
    createWindow();
});

app.on('before-quit', () => {
    if (os.platform() === 'win32') {
        // Encerra o processo pelo nome no Windows
        exec('taskkill /IM "Printers Data Manager.exe" /F', (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao encerrar processo: ${error}`);
                return;
            }
            console.log(`Processos encerrados: ${stdout}`);
        });
    } else {
        // Handle process termination for Linux and macOS if needed
        // For example, you can use `pkill` for Linux
        exec('pkill -f "Printers Data Manager"', (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao encerrar processo: ${error}`);
                return;
            }
            console.log(`Processos encerrados: ${stdout}`);
        });
    }
    // Fechar todas as janelas
    BrowserWindow.getAllWindows().forEach(window => window.destroy());
    // Destruir a bandeja se ela existir
    if (tray) {
        tray.destroy();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
