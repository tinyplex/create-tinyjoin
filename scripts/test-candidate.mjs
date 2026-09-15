import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tinyjoinRoot = resolve(root, '../tinyjoin');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!existsSync(resolve(tinyjoinRoot, 'dist/package.json'))) {
  throw new Error('Build the sibling TinyJoin candidate first: npm --prefix ../tinyjoin run build');
}
const temporary = await mkdtemp(resolve(tmpdir(), 'create-tinyjoin-candidate-'));
try {
  const [packed] = JSON.parse(run(
    ['pack', './dist', '--ignore-scripts', '--json', '--pack-destination', temporary],
    tinyjoinRoot,
    'pipe',
  ));
  if (!packed || typeof packed.filename !== 'string') {
    throw new Error('npm pack did not report a TinyJoin tarball');
  }
  const tarball = resolve(temporary, packed.filename);
  console.log(`Testing local candidate ${tarball}`);
  run(['run', 'test:e2e'], root, 'inherit', {
    CREATE_TINYJOIN_DEPENDENCY: pathToFileURL(tarball).href,
  });
} finally {
  await rm(temporary, {force: true, recursive: true});
}

function run(args, cwd, stdio, environment = {}) {
  const result = spawnSync(npm, args, {
    cwd,
    encoding: 'utf8',
    stdio,
    env: {...process.env, ...environment},
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with ${result.status}:\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  return result.stdout;
}
