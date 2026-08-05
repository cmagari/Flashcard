const {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  dialog,
  shell,
  ipcMain,
} = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const http = require("node:http");

const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
const ICON_PATH = path.join(
  __dirname,
  process.platform === "win32" ? "icon.ico" : "icon.png",
);

Menu.setApplicationMenu(null);

if (process.platform === "win32") {
  app.setAppUserModelId("com.flashcard.app");
}

let backendProcess = null;
let backendPort = null;
let mainWindow = null;

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf8");
  } catch (err) {
    console.warn("[config] write failed", err);
  }
}

function getDataDirOverride() {
  const cfg = readConfig();
  return typeof cfg.dataDir === "string" && cfg.dataDir ? cfg.dataDir : null;
}

function setDataDirOverride(dir) {
  const cfg = readConfig();
  if (dir) cfg.dataDir = dir;
  else delete cfg.dataDir;
  writeConfig(cfg);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForHealth(port, attempts = 100) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      tries++;
      const req = http.request(
        { host: "127.0.0.1", port, path: "/health", timeout: 800 },
        (res) => {
          if (res.statusCode === 200) {
            res.resume();
            resolve();
          } else {
            res.resume();
            retry();
          }
        },
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
      req.end();
      function retry() {
        if (tries >= attempts) {
          reject(new Error(`Backend did not become healthy after ${attempts} attempts`));
          return;
        }
        setTimeout(tick, 200);
      }
    };
    tick();
  });
}

async function startBackend() {
  const port = await findFreePort();
  backendPort = port;

  let cmd;
  let args;
  let cwd;
  if (isDev) {
    cwd = path.resolve(__dirname, "..", "backend");
    cmd = "uv";
    args = [
      "run",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--reload",
    ];
  } else {
    const exeName =
      process.platform === "win32" ? "flashcard-backend.exe" : "flashcard-backend";
    const bundledExe = path.join(process.resourcesPath, "backend", exeName);
    cwd = path.dirname(bundledExe);
    cmd = bundledExe;
    args = ["--host", "127.0.0.1", "--port", String(port)];
  }

  const env = {
    ...process.env,
    // Backend listens on 127.0.0.1 only. The renderer runs from file:// in
    // packaged mode, which sends Origin: null. Easiest correct CORS for a
    // local desktop app is allow-all.
    FLASHCARD_CORS_ORIGINS: "*",
  };
  const override = getDataDirOverride();
  if (override) {
    env.FLASHCARD_DATA_DIR = override;
  } else {
    delete env.FLASHCARD_DATA_DIR;
  }

  console.log(`[backend] ${cmd} ${args.join(" ")} (cwd=${cwd})`);
  if (override) console.log(`[backend] FLASHCARD_DATA_DIR=${override}`);
  backendProcess = spawn(cmd, args, {
    cwd,
    shell: isDev && process.platform === "win32",
    env,
  });
  backendProcess.stdout.on("data", (d) =>
    process.stdout.write(`[backend] ${d}`),
  );
  backendProcess.stderr.on("data", (d) =>
    process.stderr.write(`[backend] ${d}`),
  );
  backendProcess.on("exit", (code, signal) => {
    console.log(`[backend] exited code=${code} signal=${signal}`);
    backendProcess = null;
  });
  await waitForHealth(port);
  console.log(`[backend] healthy on 127.0.0.1:${port}`);
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill();
    } catch (err) {
      console.warn("[backend] kill error", err);
    }
  }
  backendProcess = null;
}

function waitForBackendExit(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (!backendProcess) return resolve();
      if (Date.now() - start > timeoutMs) return resolve();
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function restartBackend() {
  stopBackend();
  await waitForBackendExit();
  await startBackend();
}

// Chromium is supposed to fetch a Hunspell dictionary from Google's CDN the
// first time spellcheck is needed. On some machines that download never even
// gets attempted — <userData>/Dictionaries stays empty forever, so no word is
// ever flagged and the context menu has no corrections to offer. It does load
// a dictionary that is already sitting in that folder, so we ship one and copy
// it into place at startup. The name must match what Chromium looks for:
// <lang>-<feature version>.bdic. If an Electron upgrade bumps that version,
// refresh the bundled file from https://redirector.gvt1.com/edgedl/chrome/dict/.
const SPELLCHECK_LANGUAGE = "en-US";
const BUNDLED_DICTIONARY = "en-us-10-1.bdic";
const INSTALLED_DICTIONARY = "en-US-10-1.bdic";

function bundledDictionaryDir() {
  return isDev
    ? path.join(__dirname, "dictionaries")
    : path.join(process.resourcesPath, "dictionaries");
}

function setUpSpellChecker(ses) {
  try {
    const src = path.join(bundledDictionaryDir(), BUNDLED_DICTIONARY);
    const destDir = path.join(app.getPath("userData"), "Dictionaries");
    const dest = path.join(destDir, INSTALLED_DICTIONARY);
    if (!fs.existsSync(dest)) {
      if (!fs.existsSync(src)) {
        console.warn(`[spellcheck] bundled dictionary missing: ${src}`);
      } else {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(`[spellcheck] installed dictionary -> ${dest}`);
      }
    }

    ses.setSpellCheckerEnabled(true);
    ses.setSpellCheckerLanguages([SPELLCHECK_LANGUAGE]);
    console.log(
      `[spellcheck] enabled=${ses.isSpellCheckerEnabled()} languages=${ses
        .getSpellCheckerLanguages()
        .join(", ")} dictionary=${fs.existsSync(dest) ? "present" : "MISSING"}`,
    );
  } catch (err) {
    console.warn("[spellcheck] setup failed", err);
  }
}

// There is no application menu (see Menu.setApplicationMenu(null)), so the
// context menu is the only place spelling suggestions and the clipboard verbs
// can surface. Chromium underlines misspellings on its own once spellcheck is
// enabled; the suggestions arrive on the context-menu event params.
function attachContextMenu(win) {
  win.webContents.on("context-menu", (_event, params) => {
    const menu = new Menu();
    const { misspelledWord, dictionarySuggestions, editFlags } = params;

    if (misspelledWord) {
      if (dictionarySuggestions.length === 0) {
        menu.append(
          new MenuItem({ label: "No spelling suggestions", enabled: false }),
        );
      } else {
        for (const suggestion of dictionarySuggestions.slice(0, 6)) {
          menu.append(
            new MenuItem({
              label: suggestion,
              click: () => win.webContents.replaceMisspelling(suggestion),
            }),
          );
        }
      }
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(
        new MenuItem({
          label: "Add to dictionary",
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(
              misspelledWord,
            ),
        }),
      );
      menu.append(new MenuItem({ type: "separator" }));
    }

    if (params.isEditable || params.selectionText) {
      menu.append(
        new MenuItem({ role: "cut", enabled: editFlags.canCut }),
      );
      menu.append(
        new MenuItem({ role: "copy", enabled: editFlags.canCopy }),
      );
      menu.append(
        new MenuItem({ role: "paste", enabled: editFlags.canPaste }),
      );
      if (params.isEditable) {
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(
          new MenuItem({ role: "selectAll", enabled: editFlags.canSelectAll }),
        );
      }
    }

    if (isDev) {
      if (menu.items.length > 0) menu.append(new MenuItem({ type: "separator" }));
      menu.append(
        new MenuItem({
          label: "Inspect element",
          click: () => win.webContents.inspectElement(params.x, params.y),
        }),
      );
    }

    if (menu.items.length > 0) menu.popup({ window: win });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#09090b",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: true,
    },
  });

  setUpSpellChecker(mainWindow.webContents.session);
  attachContextMenu(mainWindow);

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5183");
  } else {
    await mainWindow.loadFile(
      path.join(process.resourcesPath, "frontend", "index.html"),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("flashcard:base-url", () => `http://127.0.0.1:${backendPort}`);

ipcMain.on("flashcard:base-url-sync", (event) => {
  event.returnValue = `http://127.0.0.1:${backendPort}`;
});

ipcMain.handle("flashcard:open-path", async (_evt, p) => {
  if (typeof p !== "string" || !p) return "Invalid path";
  return shell.openPath(p);
});

ipcMain.handle("flashcard:get-data-dir-override", () => getDataDirOverride());

ipcMain.handle("flashcard:choose-data-dir", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Flashcard data folder",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: getDataDirOverride() || app.getPath("documents"),
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle("flashcard:set-data-dir", async (_evt, dir) => {
  if (typeof dir !== "string" || !dir) throw new Error("Invalid folder path");
  setDataDirOverride(dir);
  await restartBackend();
  return `http://127.0.0.1:${backendPort}`;
});

ipcMain.handle("flashcard:reset-data-dir", async () => {
  setDataDirOverride(null);
  await restartBackend();
  return `http://127.0.0.1:${backendPort}`;
});

function backendGetJson(p) {
  return new Promise((resolve, reject) => {
    if (!backendPort) return reject(new Error("Backend not running"));
    const req = http.request(
      { host: "127.0.0.1", port: backendPort, path: p, method: "GET", timeout: 3000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

ipcMain.handle("flashcard:list-backups", () => backendGetJson("/api/backup"));

ipcMain.handle("flashcard:restore-backup", async (_evt, filename) => {
  if (typeof filename !== "string" || !filename) {
    throw new Error("Invalid backup filename");
  }
  // Resolve current paths BEFORE stopping the backend.
  const info = await backendGetJson("/api/info");
  const backupsDir = path.resolve(path.join(info.data_dir, "backups"));
  const backupPath = path.resolve(path.join(backupsDir, filename));
  if (!backupPath.startsWith(backupsDir + path.sep)) {
    throw new Error("Backup path is outside the backups folder");
  }
  if (!fs.existsSync(backupPath)) {
    throw new Error("Backup file not found");
  }

  stopBackend();
  await waitForBackendExit();

  const dbPath = info.db_path;
  if (fs.existsSync(dbPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const sidecar = path.join(info.data_dir, `flashcards-replaced-${ts}.db`);
    fs.renameSync(dbPath, sidecar);
  }
  fs.copyFileSync(backupPath, dbPath);

  await startBackend();
  return `http://127.0.0.1:${backendPort}`;
});

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (err) {
    console.error("Failed to start backend:", err);
    app.quit();
    return;
  }
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let backupAttempted = false;

function runQuitBackup() {
  return new Promise((resolve) => {
    if (!backendPort) return resolve();
    console.log("[backup] taking quit-time backup…");
    const req = http.request(
      {
        host: "127.0.0.1",
        port: backendPort,
        path: "/api/backup",
        method: "POST",
        timeout: 5000,
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log("[backup] saved");
          } else {
            console.warn(`[backup] HTTP ${res.statusCode}`);
          }
          resolve();
        });
      },
    );
    req.on("error", (err) => {
      console.warn("[backup] failed:", err.message);
      resolve();
    });
    req.on("timeout", () => {
      console.warn("[backup] timed out");
      req.destroy();
      resolve();
    });
    req.end();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (e) => {
  if (backupAttempted) return;
  backupAttempted = true;
  e.preventDefault();
  try {
    await runQuitBackup();
  } finally {
    stopBackend();
    app.quit();
  }
});

process.on("exit", stopBackend);
process.on("SIGINT", () => {
  stopBackend();
  process.exit(0);
});
