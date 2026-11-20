#!/usr/bin/env node
'use strict';
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const NM = path.join(root, 'node_modules');
const siteDir = path.join(root, 'exampleSite');
const publicDir = path.join(siteDir, 'public');
// Resolve Hugo from HUGO_BIN, falling back to the one on PATH.
const hugo = process.env.HUGO_BIN || 'hugo';
const tailwindCli = path.join(NM, '@tailwindcss', 'cli', 'dist', 'index.mjs');
const pagefindCli = path.join(NM, 'pagefind', 'lib', 'runner', 'bin.cjs');

function run(cmd, args) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false });
  if (r.error) {
    if (r.error.code === 'ENOENT' && cmd === hugo) {
      console.error('Hugo not found. Install Hugo Extended, put "hugo" on PATH, or set HUGO_BIN=/path/to/hugo.');
    }
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status);
}

function css() {
  run(process.execPath, [tailwindCli, '-i', 'assets/css/main.css', '-o', 'static/css/main.css', '--minify']);
}

// Dev only: keep Tailwind watching so CSS edits rebuild without a manual command.
function watchCss() {
  const child = spawn(process.execPath, [
    tailwindCli, '-i', 'assets/css/main.css', '-o', 'static/css/main.css', '--minify', '--watch',
  ], { cwd: root, stdio: 'inherit', shell: false });
  child.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
  });
  // Also stop the watcher when run() exits early on an error.
  process.on('exit', () => child.kill());
  return child;
}

const task = process.argv[2] || 'build';

if (task === 'css') {
  css();
} else if (task === 'build' || task === 'preview') {
  css();
  run(hugo, ['build', '--source', siteDir, '--cleanDestinationDir', '--minify']);
  run(process.execPath, [pagefindCli, '--site', publicDir]);
} else if (task === 'dev') {
  css();
  const watcher = watchCss();
  run(hugo, ['server', '--source', siteDir]);
  watcher.kill();
} else {
  console.error('Unknown task: ' + task);
  process.exit(1);
}
