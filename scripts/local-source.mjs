import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tinygresRoot = resolve(root, '../tinygres');
const invocationRoot = resolve(process.env.INIT_CWD ?? process.cwd());
const cache = resolve(
  root,
  'node_modules/.cache/create-tinygres/local-package',
);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!existsSync(resolve(tinygresRoot, 'package.json'))) {
  throw new Error(`Expected a sibling TinyGres repository at ${tinygresRoot}`);
}

run(npm, ['run', 'build'], tinygresRoot, 'inherit');
run(npm, ['run', 'build'], root, 'inherit');

await rm(cache, {force: true, recursive: true});
await mkdir(cache, {recursive: true});

const [packed] = JSON.parse(
  run(
    npm,
    [
      'pack',
      './dist',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      cache,
    ],
    tinygresRoot,
    'pipe',
  ),
);

if (!packed || typeof packed.filename !== 'string') {
  throw new Error('npm pack did not report a TinyGres tarball');
}

const tarball = resolve(cache, packed.filename);
if (!existsSync(tarball)) {
  throw new Error(`npm pack did not create ${tarball}`);
}
console.log(`Using local TinyGres package ${tarball}\n`);

run(
  process.execPath,
  [resolve(root, 'dist/cli.js'), ...process.argv.slice(2)],
  invocationRoot,
  'inherit',
  {CREATE_TINYGRES_DEPENDENCY: pathToFileURL(tarball).href},
);

function run(command, args, cwd, stdio, environment = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
    env: {...process.env, ...environment},
    maxBuffer: 20 * 1024 * 1024,
    stdio,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    throw new Error(
      `${command} ${args.join(' ')} failed with ${result.status}${
        output ? `:\n${output}` : ''
      }`,
    );
  }

  return result.stdout ?? '';
}
