#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const tailscaleCommand = process.platform === 'win32' ? 'tailscale.exe' : 'tailscale';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function writeError(message) {
  process.stderr.write(`${message}\n`);
}

function runTailscale(args, options = {}) {
  const result = spawnSync(tailscaleCommand, args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  });

  if (result.error) {
    writeError(`Could not run Tailscale: ${result.error.message}`);
    return null;
  }

  if (result.status !== 0) {
    if (!options.inherit) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    return null;
  }

  return result;
}

function getTailnetHostname() {
  const result = runTailscale(['status', '--json']);
  if (!result) return null;

  try {
    const status = JSON.parse(result.stdout);
    const dnsName = status.Self?.DNSName;
    if (typeof dnsName !== 'string' || !dnsName.trim()) {
      writeError('Tailscale did not report a MagicDNS hostname for this machine.');
      return null;
    }
    return dnsName.trim().replace(/\.$/, '');
  } catch (error) {
    writeError(`Could not parse Tailscale status: ${error.message}`);
    return null;
  }
}

function getDevPort() {
  const rawPort = process.env.TAILSCALE_DEV_PORT ?? '5173';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    writeError(`TAILSCALE_DEV_PORT must be an integer from 1 to 65535, received "${rawPort}".`);
    return null;
  }
  return port;
}

function ensureServeIsAvailable() {
  const result = runTailscale(['serve', 'status', '--json']);
  if (!result) return false;

  try {
    const serveStatus = JSON.parse(result.stdout);
    if (serveStatus && Object.keys(serveStatus).length > 0) {
      writeError('Tailscale Serve already has a configuration. This command will not replace it.');
      writeError('Remove the existing Serve configuration before trying again.');
      return false;
    }
    return true;
  } catch (error) {
    writeError(`Could not parse Tailscale Serve status: ${error.message}`);
    return false;
  }
}

function configureServe(port) {
  return Boolean(
    runTailscale(['serve', '--bg', '--yes', `http://127.0.0.1:${port}`], { inherit: true }),
  );
}

function removeServe() {
  const result = runTailscale(['serve', '--https=443', 'off'], { inherit: true });
  if (!result) {
    writeError('Could not remove the Tailscale Serve endpoint automatically.');
  }
}

async function runDevServer(hostname, port) {
  const devServer = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      env: {
        ...process.env,
        __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: hostname,
      },
      stdio: 'inherit',
    },
  );

  let receivedSignal = null;
  const stopDevServer = (signal) => {
    receivedSignal = signal;
    if (!devServer.killed) devServer.kill(signal);
  };
  process.once('SIGINT', () => stopDevServer('SIGINT'));
  process.once('SIGTERM', () => stopDevServer('SIGTERM'));

  const result = await new Promise((resolve) => {
    devServer.once('error', (error) => resolve({ error }));
    devServer.once('exit', (code, signal) => resolve({ code, signal }));
  });

  removeServe();

  if (result.error) {
    writeError(`Could not start the Vite dev server: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }

  if (receivedSignal === 'SIGINT' || result.signal === 'SIGINT') {
    process.exitCode = 130;
    return;
  }
  if (receivedSignal === 'SIGTERM' || result.signal === 'SIGTERM') {
    process.exitCode = 143;
    return;
  }
  process.exitCode = result.code ?? 1;
}

async function main() {
  const hostname = getTailnetHostname();
  const port = getDevPort();
  if (!hostname || !port) {
    process.exitCode = 1;
    return;
  }

  if (!ensureServeIsAvailable()) {
    process.exitCode = 1;
    return;
  }

  if (!configureServe(port)) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    [
      '',
      `Private Tailscale URL: https://${hostname}/`,
      "Using the project's existing environment and database configuration.",
      'Press Ctrl+C to stop Vite and remove the Tailscale Serve endpoint.',
      '',
    ].join('\n'),
  );

  await runDevServer(hostname, port);
}

main().catch((error) => {
  writeError(`Tailscale dev server failed: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
