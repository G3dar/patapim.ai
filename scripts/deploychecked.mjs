#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const args = new Set(process.argv.slice(2));
const skipBuild = args.has('--skip-build');
const skipDeploy = args.has('--skip-deploy');
const skipList = args.has('--skip-list');
const skipApp = args.has('--skip-app');
const skipAppBuild = skipApp || args.has('--skip-app-build');
const skipAppRestart = skipApp || args.has('--skip-app-restart');
const quick = args.has('--quick');
const dryRun = args.has('--dry-run');

const baseUrl = process.env.DEPLOYCHECKED_URL || 'https://patapim.ai';
const remotePath = process.env.DEPLOYCHECKED_REMOTE_PATH || '/remote';
const appRepoDir = path.resolve(process.cwd(), process.env.DEPLOYCHECKED_APP_DIR || '../patapim');
const appProcessList = (process.env.DEPLOYCHECKED_APP_PROCESSES || 'PATAPIM')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const appLaunchCommand = process.env.DEPLOYCHECKED_APP_LAUNCH || '';
const verifyAttempts = quick ? 1 : 5;
const verifyDelayMs = quick ? 0 : 2500;

function printStep(title) {
  console.log(`\n== ${title} ==`);
}

function runCommand(commandLine, label, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd,
      env: process.env,
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

function runProcess(file, args, label, options = {}) {
  const {
    cwd = process.cwd(),
    stdio = 'pipe',
    detached = false,
    windowsHide = true,
    allowedExitCodes = [0]
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      env: process.env,
      stdio,
      detached,
      windowsHide,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.on('error', (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on('close', (code) => {
      const exitCode = typeof code === 'number' ? code : -1;
      if (allowedExitCodes.includes(exitCode)) {
        resolve({ stdout, stderr, code: exitCode });
      } else {
        reject(new Error(`${label} failed with exit code ${exitCode}`));
      }
    });
  });
}

function runDetachedProcess(file, args, cwd) {
  const child = spawn(file, args, {
    cwd,
    env: process.env,
    stdio: 'ignore',
    detached: true,
    windowsHide: false,
    shell: false
  });
  child.unref();
}

function evaluateRemoteHtml(html) {
  const checks = [
    {
      name: 'Contains detectMobileClient',
      ok: html.includes('detectMobileClient')
    },
    {
      name: 'Contains mobile flag in WS payload',
      ok: /mobile:\s*(isMobileClient|isMobileResizeMode\(\))/.test(html)
    },
    {
      name: 'Does not contain legacy syncServer !hasDims',
      ok: !html.includes('syncServer: !hasDims')
    },
    {
      name: 'Contains touch-action pan-y',
      ok: html.includes('touch-action: pan-y')
    }
  ];

  const passed = checks.every((item) => item.ok);
  return { passed, checks };
}

async function ensureAssetsIgnore() {
  const distDir = path.join(process.cwd(), 'dist');
  const assetsIgnorePath = path.join(distDir, '.assetsignore');
  await mkdir(distDir, { recursive: true });
  await writeFile(assetsIgnorePath, '_worker.js\n', 'utf8');
  console.log(`Prepared ${assetsIgnorePath}`);
}

function ensureAppRepo() {
  const packageJson = path.join(appRepoDir, 'package.json');
  if (!fs.existsSync(packageJson)) {
    throw new Error(`Desktop app repo not found. Expected: ${packageJson}`);
  }
}

async function rebuildDesktopApp() {
  ensureAppRepo();
  await runCommand('npm run build:prod:main', 'Desktop build:prod:main', appRepoDir);
  await runCommand('npm run build:prod:bytecode', 'Desktop build:prod:bytecode', appRepoDir);
  await runCommand('npm run build:electron', 'Desktop build:electron', appRepoDir);
}

function resolveDesktopLaunchTarget() {
  if (appLaunchCommand) {
    return { type: 'command', value: appLaunchCommand };
  }

  const candidates = [
    path.join(appRepoDir, 'release', 'win-unpacked', 'PATAPIM.exe'),
    path.join(appRepoDir, 'release', 'PATAPIM.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'PATAPIM', 'PATAPIM.exe')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return { type: 'exe', value: candidate };
    }
  }

  return { type: 'command', value: 'npm start' };
}

async function restartDesktopApp() {
  ensureAppRepo();

  if (process.platform !== 'win32') {
    throw new Error('Desktop app restart is implemented for Windows only');
  }

  if (appProcessList.length > 0) {
    for (const rawName of appProcessList) {
      const clean = rawName.trim();
      if (!clean) continue;
      const image = clean.toLowerCase().endsWith('.exe') ? clean : `${clean}.exe`;
      await runProcess('taskkill.exe', ['/F', '/T', '/IM', image], `Desktop stop (${image})`, {
        allowedExitCodes: [0, 1] // 1 = not running
      });
    }
    await delay(900);
  }

  const launchTarget = resolveDesktopLaunchTarget();
  if (launchTarget.type === 'exe') {
    const exePath = launchTarget.value;
    const exeDir = path.dirname(exePath);
    runDetachedProcess(exePath, [], exeDir);
    return;
  }

  // Launch command in detached shell so this script can finish immediately.
  runDetachedProcess('cmd.exe', ['/c', launchTarget.value], appRepoDir);
}

async function fetchRemote() {
  const stamp = Date.now();
  const connector = remotePath.includes('?') ? '&' : '?';
  const url = `${baseUrl}${remotePath}${connector}v=${stamp}`;
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while requesting ${url}`);
  }

  const html = await response.text();
  return { url, html };
}

async function verifyRemoteContent() {
  let lastResult = null;
  let lastUrl = `${baseUrl}${remotePath}`;

  for (let attempt = 1; attempt <= verifyAttempts; attempt += 1) {
    printStep(`Verify remote content (attempt ${attempt}/${verifyAttempts})`);

    const { url, html } = await fetchRemote();
    lastUrl = url;
    const result = evaluateRemoteHtml(html);
    lastResult = result;

    console.log(`URL checked: ${url}`);
    for (const check of result.checks) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'} - ${check.name}`);
    }

    if (result.passed) {
      return { passed: true, result, url };
    }

    if (attempt < verifyAttempts) {
      await delay(verifyDelayMs);
    }
  }

  return { passed: false, result: lastResult, url: lastUrl };
}

async function main() {
  try {
    if (!skipAppBuild) {
      printStep('Desktop Rebuild');
      await rebuildDesktopApp();
    } else {
      printStep('Desktop Rebuild');
      console.log('Skipped (--skip-app-build or --skip-app)');
    }

    if (!skipBuild) {
      printStep('Build');
      await runCommand('npm run build', 'Build');
    } else {
      printStep('Build');
      console.log('Skipped (--skip-build)');
    }

    if (!skipDeploy) {
      printStep('Deploy');
      await ensureAssetsIgnore();
      const deployCmd = dryRun ? 'npx wrangler deploy --dry-run' : 'npx wrangler deploy';
      await runCommand(deployCmd, 'Deploy');
    } else {
      printStep('Deploy');
      console.log('Skipped (--skip-deploy)');
    }

    if (!skipList) {
      printStep('Deployments list');
      await runCommand('npx wrangler deployments list --config wrangler.toml', 'Deployments list');
    } else {
      printStep('Deployments list');
      console.log('Skipped (--skip-list)');
    }

    const verify = await verifyRemoteContent();
    if (!verify.passed) {
      console.error('\nDEPLOYCHECKED FAILED');
      console.error(`Last URL checked: ${verify.url}`);
      process.exitCode = 1;
      return;
    }

    if (!skipAppRestart) {
      printStep('Desktop Restart');
      await restartDesktopApp();
    } else {
      printStep('Desktop Restart');
      console.log('Skipped (--skip-app-restart or --skip-app)');
    }

    console.log('\nDEPLOYCHECKED OK');
    console.log(`Verified URL: ${verify.url}`);
  } catch (error) {
    console.error(`\nDEPLOYCHECKED FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
