const { app, BrowserWindow, Menu, dialog, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const STUDIO_URL = "https://inked-figure-studio.lovable.app/";
const AUTH_POPUP_HOSTS = new Set([
  "inked-figure-studio.lovable.app",
  "inked-figure-studio-app.firebaseapp.com",
  "accounts.google.com",
  "accounts.youtube.com",
]);

let mainWindow = null;

function getStateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowBounds() {
  const defaults = { width: 1360, height: 860 };
  try {
    const raw = fs.readFileSync(getStateFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.width === "number" &&
      typeof parsed.height === "number" &&
      parsed.width >= 380 &&
      parsed.height >= 420
    ) {
      return parsed;
    }
  } catch {
    // use defaults
  }
  return defaults;
}

function saveWindowBounds(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getNormalBounds();
    fs.writeFileSync(getStateFile(), JSON.stringify(bounds), "utf8");
  } catch {
    // ignore
  }
}

function cleanUserAgent(ua) {
  return String(ua || "")
    .replace(/\s*Electron\/[^\s]+/g, "")
    .replace(/\s*mangakadesk-desktop\/[^\s]+/gi, "");
}

function isAuthPopupUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return (
      AUTH_POPUP_HOSTS.has(parsed.hostname) ||
      parsed.hostname.endsWith(".google.com") ||
      parsed.hostname.endsWith(".firebaseapp.com") ||
      parsed.hostname.endsWith(".lovable.app")
    );
  } catch {
    return false;
  }
}

function createOfflineHtml(message) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>MangakaDesk — Offline</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #faf6ef; color: #111111; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      .card { border: 2px solid #111111; background: #ffffff; padding: 28px; max-width: 420px; text-align: center; box-shadow: 4px 4px 0 #111111; }
      button { margin-top: 16px; border: 2px solid #111111; background: #e11d2e; color: #ffffff; padding: 10px 20px; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>MANGAKADESK</h2>
      <p>${message}</p>
      <button onclick="location.href='${STUDIO_URL}'">Retry Connection</button>
    </div>
  </body>
</html>`)}`;
}

function setupAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Reload Studio",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.reload(),
        },
        {
          label: "Home",
          click: () => void mainWindow?.loadURL(STUDIO_URL),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const chromeUa = cleanUserAgent(session.defaultSession.getUserAgent());
  session.defaultSession.setUserAgent(chromeUa);

  const bounds = loadWindowBounds();
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 380,
    minHeight: 420,
    backgroundColor: "#faf6ef",
    title: "MangakaDesk",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setUserAgent(chromeUa);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopupUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          parent: win,
          modal: false,
          autoHideMenuBar: true,
          backgroundColor: "#faf6ef",
          icon: path.join(__dirname, "build", "icon.ico"),
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.session.on("will-download", (_event, item) => {
    const suggested = item.getFilename() || "mangakadesk-export";
    const defaultPath = path.join(app.getPath("downloads"), suggested);
    const saveChoice = dialog.showSaveDialogSync(win, {
      title: "Save MangakaDesk File",
      defaultPath,
    });
    if (!saveChoice) {
      item.cancel();
      return;
    }
    item.setSavePath(saveChoice);
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (validatedURL.startsWith("data:")) return;
    void win.loadURL(
      createOfflineHtml(`Could not connect (${errorDesc}). Check your internet connection and retry.`),
    );
  });

  win.on("resize", () => saveWindowBounds(win));
  win.on("move", () => saveWindowBounds(win));
  win.on("close", () => saveWindowBounds(win));

  void win.loadURL(STUDIO_URL);
  mainWindow = win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    setupAppMenu();
    createMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
