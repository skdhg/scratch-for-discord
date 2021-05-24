const { app, BrowserWindow, shell, session, dialog, Tray, Menu } = require("electron");
const startDate = new Date();
const Updater = require("./updates/window");
const updater = new Updater();
const rpc = require("./RPC");
let version,
    mainWindow,
    tray = null;

try {
    version = require(`${__dirname}/../package.json`).version;
} catch (e) {
    version = "1.1.2";
}

app.on("ready", async () => {
    updater.create();
    const proc = await updater.init();
    if (!proc) return updater.close();

    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders["User-Agent"] = "";
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    mainWindow = new BrowserWindow({
        show: false,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: false,
            preload: `${__dirname}/preload.js`
        }
    });

    mainWindow.loadFile(`${__dirname}/public/loader.html`);

    if (mainWindow.maximizable) mainWindow.maximize();

    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
        updater.close();
    });

    tray = new Tray(`${__dirname}/assets/icon.png`);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Discord Server",
            type: "normal",
            click: () => shell.openExternal("https://androz2091.fr/discord")
        },
        {
            label: "GitHub",
            type: "normal",
            click: () => shell.openExternal("https://github.com/Androz2091/scratch-for-discord")
        },
        {
            label: "Check for updates",
            type: "normal",
            click: () => {
                app.relaunch();
                app.quit();
            }
        },
        {
            label: "Quit App",
            type: "normal",
            click: () => {
                mainWindow.destroy();
            }
        }
    ]);
    tray.setToolTip("Scratch For Discord");
    tray.setContextMenu(contextMenu);

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
    });

    mainWindow.on("page-title-updated", createPresence);

    mainWindow.on("close", async (ev) => {
        ev.preventDefault();

        const response = await dialog.showMessageBox(mainWindow, {
            type: "question",
            buttons: ["Yes", "No"],
            title: "Confirm",
            message: "Do you really want to quit Scratch For Discord?"
        });

        if (response.response === 1) return;
        try {
            mainWindow.destroy();
        } catch (e) {}
    });

    mainWindow.webContents.on("dom-ready", () => {
        if (!mainWindow.webContents.getURL().includes("scratch-for-discord.netlify.app")) {
            mainWindow.loadURL("https://scratch-for-discord.netlify.app");
        } else {
            mainWindow.webContents.executeJavaScript(`
                if (window.__scratch__) {
                    const y = document.createElement("li");
                    y.classList.add("nav-item");
                    y.innerHTML = '<a href="#" class="nav-link" id="nav-close-window">Exit</a>';
                    document.querySelector("ul[class='navbar-nav']").appendChild(y);

                    document.getElementById("nav-close-window").addEventListener("click", (e) => {
                        e.preventDefault();
                        return window.__scratch__.closeWindow();
                    });
                }
            `);
        }
    });
});

rpc.on("ready", () => createPresence());

function createPresence() {
    const getTitle = () => {
        const title = mainWindow && mainWindow.webContents.getTitle();
        if (!title || !title.includes("-")) return "Starting...";
        const text = title.split("-")[1].trim();
        return text.toLowerCase() === "make your own bot using blocks" ? "Untitled document" : text;
    };

    const currentTitle = getTitle();

    if (currentTitle.length >= 2) {
        setTimeout(() => {
            rpc.request("SET_ACTIVITY", {
                pid: process.pid,
                activity: {
                    details: currentTitle,
                    timestamps: {
                        start: startDate.getTime()
                    },
                    assets: {
                        large_image: "large",
                        large_text: `Scratch For Discord - v${version}`
                    },
                    buttons: [
                        {
                            label: "Download",
                            url: "https://github.com/Androz2091/scratch-for-discord"
                        }
                    ]
                }
            });
        }, 1500);
    }
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});