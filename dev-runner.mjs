// ============================================================================
// Dual Development Runner for AI TARGET STRIKE
// Concurrently starts Flask Backend (:5000) and React Vite Frontend (:5173)
// ============================================================================

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[36m%s\x1b[0m', '====================================================================');
console.log('\x1b[36m%s\x1b[0m', '      AI TARGET STRIKE — DUAL DEVELOPMENT SERVER LAUNCHER           ');
console.log('\x1b[36m%s\x1b[0m', '====================================================================');

// Locate Python venv executable
const venvPythonWin = path.join(__dirname, 'teamnexus', 'backend', 'venv', 'Scripts', 'python.exe');
const venvPythonPosix = path.join(__dirname, 'teamnexus', 'backend', 'venv', 'bin', 'python');
let pythonCmd = 'python';

if (fs.existsSync(venvPythonWin)) {
  pythonCmd = venvPythonWin;
} else if (fs.existsSync(venvPythonPosix)) {
  pythonCmd = venvPythonPosix;
}

console.log(`[Launcher] Using Python interpreter: ${pythonCmd}`);

// 1. Launch Flask Backend
const backendEnv = {
  ...process.env,
  PYTHONPATH: path.join(__dirname, 'teamnexus', 'backend'),
  PYTHONUNBUFFERED: '1'
};

const backendProcess = spawn(
  pythonCmd,
  [path.join(__dirname, 'teamnexus', 'backend', 'run.py')],
  {
    cwd: path.join(__dirname, 'teamnexus', 'backend'),
    env: backendEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false
  }
);

backendProcess.stdout.on('data', (chunk) => {
  const lines = chunk.toString().split('\n').filter(Boolean);
  lines.forEach((line) => {
    console.log(`\x1b[36m[BACKEND :5000]\x1b[0m ${line}`);
  });
});

backendProcess.stderr.on('data', (chunk) => {
  const lines = chunk.toString().split('\n').filter(Boolean);
  lines.forEach((line) => {
    console.error(`\x1b[33m[BACKEND :5000]\x1b[0m ${line}`);
  });
});

backendProcess.on('error', (err) => {
  console.error('\x1b[31m[BACKEND ERROR]\x1b[0m Failed to start backend:', err.message);
});

// 2. Launch Vite Frontend
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const frontendProcess = spawn(
  npmCmd,
  ['--prefix', 'teamnexus/frontend', 'run', 'dev'],
  {
    cwd: __dirname,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWin
  }
);

frontendProcess.stdout.on('data', (chunk) => {
  const lines = chunk.toString().split('\n').filter(Boolean);
  lines.forEach((line) => {
    console.log(`\x1b[32m[FRONTEND :5173]\x1b[0m ${line}`);
  });
});

frontendProcess.stderr.on('data', (chunk) => {
  const lines = chunk.toString().split('\n').filter(Boolean);
  lines.forEach((line) => {
    console.error(`\x1b[35m[FRONTEND :5173]\x1b[0m ${line}`);
  });
});

frontendProcess.on('error', (err) => {
  console.error('\x1b[31m[FRONTEND ERROR]\x1b[0m Failed to start frontend:', err.message);
});

// Clean shutdown handler
const shutdown = () => {
  console.log('\n[Launcher] Shutting down services cleanly...');
  try { backendProcess.kill('SIGTERM'); } catch (e) {}
  try { frontendProcess.kill('SIGTERM'); } catch (e) {}
  setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
