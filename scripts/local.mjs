import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const invocationRoot = resolve(process.env.INIT_CWD ?? process.cwd());
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

run(npm, ['run', 'build'], root, 'inherit');
run(
  process.execPath,
  [resolve(root, 'dist/cli.js'), ...process.argv.slice(2)],
  invocationRoot,
  'inherit',
);

function run(command, args, cwd, stdio) {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
  }
}
