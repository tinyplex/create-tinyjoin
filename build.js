import * as esbuild from 'esbuild';
import {chmod, cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';

await rm('dist', {force: true, recursive: true});
await mkdir('dist', {recursive: true});

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: false,
  minify: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
});

const cli = await readFile('dist/cli.js', 'utf8');
await writeFile('dist/cli.js', `#!/usr/bin/env node\n${cli.replace(/^#!.*\n/g, '')}`);
await chmod('dist/cli.js', 0o755);

await cp('templates', 'dist/templates', {recursive: true});
await cp('README.md', 'dist/README.md');
await cp('LICENSE', 'dist/LICENSE');

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
delete manifest.private;
delete manifest.scripts;
delete manifest.devDependencies;
manifest.bin['create-tinygres'] = 'cli.js';
manifest.files = ['cli.js', 'templates', 'README.md', 'LICENSE'];
await writeFile('dist/package.json', `${JSON.stringify(manifest, null, 2)}\n`);
