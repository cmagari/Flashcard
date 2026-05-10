const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
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

  console.log(`[backend] ${cmd} ${args.join(" ")} (cwd=${cwd})`);
  backendProcess = spawn(cmd, args, {
    cwd,
    shell: isDev && process.platform === "win32",
    env: {
      ...process.env,
      // Backend listens on 127.0.0.1 only. The renderer runs from file:// in
      // packaged mode, which sends Origin: null. Easiest correct CORS for a
      // local desktop app is allow-all.
      FLASHCARD_CORS_ORIGINS: "*",
    },
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
      additionalArguments: [`--flashcard-base-url=http://127.0.0.1:${backendPort}`],
    },
  });

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

ipcMain.handle("flashcard:open-path", async (_evt, p) => {
  if (typeof p !== "string" || !p) return "Invalid path";
  return shell.openPath(p);
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

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopBackend);
process.on("exit", stopBackend);
process.on("SIGINT", () => {
  stopBackend();
  process.exit(0);
});
