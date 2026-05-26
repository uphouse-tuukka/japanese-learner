#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ignoredPathParts = new Set([
  '.git',
  '.codegraph',
  '.output',
  '.svelte-kit',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

const failures = [];

function isIgnored(relativePath) {
  if (!relativePath || relativePath === '.') {
    return false;
  }

  return relativePath.split(path.sep).some((part) => ignoredPathParts.has(part));
}

function isInside(root, target) {
  const relativePath = path.relative(root, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function assertRepoRoot(repoRoot) {
  const packagePath = path.join(repoRoot, 'package.json');
  let packageJson;

  try {
    packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  } catch (error) {
    failures.push(`Could not read package.json from ${repoRoot}: ${error.message}`);
    return;
  }

  if (packageJson.name !== 'japanese-learner') {
    failures.push(
      `Expected package.json name "japanese-learner", found "${packageJson.name ?? 'missing'}".`,
    );
  }
}

function assertCodeGraphIndexIgnored(repoRoot) {
  const result = spawnSync('git', ['check-ignore', '--quiet', '.codegraph/'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    failures.push(`Could not run git check-ignore for .codegraph/: ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    failures.push('`.codegraph/` is not ignored by git. Add it to .gitignore before indexing.');
  }
}

async function scanForEscapingSymlinks(absolutePath, repoRoot) {
  const relativePath = path.relative(repoRoot, absolutePath) || '.';

  if (isIgnored(relativePath)) {
    return;
  }

  let stats;
  try {
    stats = await lstat(absolutePath);
  } catch (error) {
    failures.push(`Could not stat ${relativePath}: ${error.message}`);
    return;
  }

  if (stats.isSymbolicLink()) {
    let targetPath;
    try {
      targetPath = await realpath(absolutePath);
    } catch (error) {
      failures.push(`Broken or unreadable symlink at ${relativePath}: ${error.message}`);
      return;
    }

    if (!isInside(repoRoot, targetPath)) {
      failures.push(`Symlink ${relativePath} points outside the repository: ${targetPath}`);
    }

    return;
  }

  if (!stats.isDirectory()) {
    return;
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) => scanForEscapingSymlinks(path.join(absolutePath, entry.name), repoRoot)),
  );
}

async function main() {
  const repoRoot = await realpath(process.cwd());

  await assertRepoRoot(repoRoot);
  assertCodeGraphIndexIgnored(repoRoot);
  await scanForEscapingSymlinks(repoRoot, repoRoot);

  if (failures.length > 0) {
    process.stderr.write(
      `CodeGraph preflight failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    'CodeGraph preflight passed: .codegraph/ is ignored and no symlinks escape the repository.\n',
  );
}

main().catch((error) => {
  process.stderr.write(`CodeGraph preflight crashed: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
