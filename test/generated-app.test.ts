import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {lstat, mkdir, readFile, readdir, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect, it} from 'vitest';
import {generatedTestRoot} from './paths.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tinygresRoot = resolve(root, '../tinygres');
const output = generatedTestRoot;
const appOutput = resolve(output, 'app');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

it.skipIf(!existsSync(resolve(tinygresRoot, 'package.json')))(
  'builds the generated app against an actual packed Tinygres package',
  async () => {
    await rm(output, {force: true, recursive: true});
    await mkdir(output, {recursive: true});

    run(
      npm,
      [
        '--prefix',
        root,
        'run',
        'local',
        '--',
        '--non-interactive',
        '--projectName',
        'app',
        '--installAndRun',
        'false',
      ],
      output,
    );

    const client = resolve(appOutput, 'client');
    const manifestPath = resolve(client, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const tinygresDependency = String(manifest.dependencies.tinygres);
    expect(tinygresDependency).toMatch(/^file:\/\/\/.*tinygres-[^/]+\.tgz$/);
    expect(existsSync(fileURLToPath(tinygresDependency))).toBe(true);

    run(npm, ['install', '--no-audit', '--no-fund'], client);
    expect(
      (await lstat(resolve(client, 'node_modules/tinygres'))).isSymbolicLink(),
    ).toBe(false);
    const installedManifest = JSON.parse(
      await readFile(
        resolve(client, 'node_modules/tinygres/package.json'),
        'utf8',
      ),
    );
    expect(installedManifest.name).toBe('tinygres');

    run(npm, ['run', 'build'], client);

    const assets = await readdir(resolve(client, 'dist/assets'));
    expect(assets.some((file) => file.endsWith('.wasm'))).toBe(true);
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
