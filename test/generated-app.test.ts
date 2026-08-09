import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect, it} from 'vitest';
import {generatedTestRoot} from './paths.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tinygresDist = resolve(root, '../tinygres/dist');
const output = generatedTestRoot;
const packageOutput = resolve(output, 'package');
const appOutput = resolve(output, 'app');
const cli = resolve(root, 'dist/cli.js');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

it.skipIf(!existsSync(resolve(tinygresDist, 'package.json')))(
  'builds the generated app against an actual packed Tinygres package',
  async () => {
    await rm(output, {force: true, recursive: true});
    await mkdir(packageOutput, {recursive: true});

    const packed = JSON.parse(
      run(
        npm,
        [
          'pack',
          tinygresDist,
          '--ignore-scripts',
          '--json',
          '--pack-destination',
          packageOutput,
        ],
        root,
      ),
    )[0];
    const tarball = resolve(packageOutput, packed.filename);

    run(
      process.execPath,
      [
        cli,
        '--non-interactive',
        '--projectName',
        'app',
        '--installAndRun',
        'false',
      ],
      output,
      {CREATE_TINYGRES_DEPENDENCY: `file:${tarball}`},
    );

    const client = resolve(appOutput, 'client');
    const manifestPath = resolve(client, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    expect(manifest.dependencies.tinygres).toBe(`file:${tarball}`);

    run(npm, ['install', '--no-audit', '--no-fund'], client);
    run(npm, ['run', 'build'], client);

    const assets = await readdir(resolve(client, 'dist/assets'));
    expect(assets.some((file) => file.endsWith('.wasm'))).toBe(true);

    // Ensure the test never leaves its local tarball dependency in a reusable
    // generated manifest if this fixture is inspected manually.
    manifest.dependencies.tinygres = '^0.0.0';
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  },
  120_000,
);

function run(
  command: string,
  args: string[],
  cwd: string,
  environment: Record<string, string> = {},
): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {...process.env, ...environment},
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with ${result.status}:\n${result.stdout}${result.stderr}`,
    );
  }
  return result.stdout;
}
