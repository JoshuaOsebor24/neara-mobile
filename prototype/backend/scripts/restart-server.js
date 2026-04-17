/* global __dirname */

const http = require("http");
const { execFileSync, spawn } = require("child_process");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const {
  app: { host, port },
} = require("../config/env");

const backendRoot = path.resolve(__dirname, "..");
const probeHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
const shutdownTimeoutMs = 10000;
const probeTimeoutMs = 1500;
const pollIntervalMs = 250;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getListeningPids() {
  try {
    const output = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      {
        cwd: backendRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    return Array.from(
      new Set(
        output
          .split(/\r?\n/)
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );
  } catch {
    return [];
  }
}

function probeLiveBackend() {
  return new Promise((resolve) => {
    const request = http.request(
      {
        host: probeHost,
        port,
        path: "/health/live",
        method: "GET",
        timeout: probeTimeoutMs,
        headers: {
          Connection: "close",
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            const payload = JSON.parse(raw || "{}");
            resolve({
              ok: response.statusCode === 200,
              pid: Number.isInteger(payload.pid) ? payload.pid : null,
            });
          } catch {
            resolve({ ok: false, pid: null });
          }
        });
      },
    );

    request.once("timeout", () => {
      request.destroy();
      resolve({ ok: false, pid: null });
    });

    request.once("error", () => {
      resolve({ ok: false, pid: null });
    });

    request.end();
  });
}

async function waitForPidToExit(pid) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < shutdownTimeoutMs) {
    try {
      process.kill(pid, 0);
      await delay(pollIntervalMs);
    } catch {
      return true;
    }
  }

  return false;
}

async function stopExistingBackendIfNeeded() {
  const listeningPids = getListeningPids();

  if (listeningPids.length === 0) {
    console.log(`[restart] no listener found on port ${port}`);
    return;
  }

  const liveBackend = await probeLiveBackend();

  if (
    !liveBackend.ok ||
    !liveBackend.pid ||
    !listeningPids.includes(liveBackend.pid)
  ) {
    throw new Error(
      `Port ${port} is in use by another process. Refusing to kill an unverified listener.`,
    );
  }

  console.log(
    `[restart] stopping backend pid ${liveBackend.pid} on port ${port}`,
  );
  process.kill(liveBackend.pid, "SIGTERM");

  const didExit = await waitForPidToExit(liveBackend.pid);

  if (!didExit) {
    throw new Error(
      `Timed out waiting for backend pid ${liveBackend.pid} to exit.`,
    );
  }

  console.log(`[restart] stopped backend pid ${liveBackend.pid}`);
}

async function main() {
  await stopExistingBackendIfNeeded();

  console.log(`[restart] starting backend on http://${host}:${port}`);

  const child = spawn(process.execPath, ["server.js"], {
    cwd: backendRoot,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[restart] failed", error?.message || String(error));
  process.exit(1);
});
