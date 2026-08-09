import {spawnSync} from 'node:child_process';
import {mkdir, readFile, readdir, rm} from 'node:fs/promises';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {beforeEach, describe, expect, it} from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'test/.test-output/cli');
const cli = resolve(root, 'dist/cli.js');

beforeEach(async () => {
  await rm(output, {force: true, recursive: true});
  await mkdir(output, {recursive: true});
});

describe('create-tinygres CLI', () => {
  it('documents its automation surface', () => {
    const help = run(['--help']);
    expect(help.stdout).toContain('npm create tinygres@latest');
    expect(help.stdout).toContain('--non-interactive');

    const catalog = JSON.parse(run(['--list-options']).stdout);
    expect(catalog.options).toEqual({
      projectName: {type: 'string', required: true},
      installAndRun: {
        values: [true, false],
        required: true,
        recommendedForAgents: false,
      },
    });
  });

  it('generates the Tinygres starter without duplicating a built demo', async () => {
    run(
      [
        '--non-interactive',
        '--projectName',
        'example',
        '--installAndRun',
        'false',
      ],
      {CREATE_TINYGRES_DEPENDENCY: '9.9.9-test'},
    );

    const project = resolve(output, 'example');
    expect(await listFiles(project)).toEqual([
      'AGENTS.md',
      'README.md',
      'client/.gitignore',
      'client/index.html',
      'client/package.json',
      'client/src/main.ts',
      'client/src/style.css',
      'client/src/vite-env.d.ts',
      'client/tsconfig.json',
    ]);

    const manifest = JSON.parse(
      await readFile(resolve(project, 'client/package.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      name: 'example-client',
      private: true,
      dependencies: {tinygres: '9.9.9-test'},
    });

    const source = await readFile(resolve(project, 'client/src/main.ts'), 'utf8');
    expect(source).toContain("from 'tinygres'");
    expect(source).toContain('createTinygresClient');
    expect(source).toContain('database.applyBatch(batch)');
    expect(source).not.toContain('../src');
  });

  it('rejects path-like and existing project names', async () => {
    expect(
      run(['--non-interactive', '--projectName', '../escape'], {}, false).status,
    ).not.toBe(0);

    await mkdir(resolve(output, 'existing'));
    const existing = run(
      ['--non-interactive', '--projectName', 'existing'],
      {},
      false,
    );
    expect(existing.status).not.toBe(0);
    expect(`${existing.stdout}${existing.stderr}`).toContain('already exists');
  });

  it('builds a public generator package under dist', async () => {
    const manifest = JSON.parse(
      await readFile(resolve(root, 'dist/package.json'), 'utf8'),
    );
    expect(manifest.private).toBeUndefined();
    expect(manifest.scripts).toBeUndefined();
    expect(manifest.devDependencies).toBeUndefined();
    expect(manifest.bin).toEqual({'create-tinygres': 'cli.js'});
    expect(manifest.files).toContain('templates');
  });
});

function run(
  args: string[],
  environment: Record<string, string> = {},
  expectSuccess = true,
) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: output,
    encoding: 'utf8',
    env: {...process.env, ...environment},
  });
  if (expectSuccess && result.status !== 0) {
    throw new Error(`${result.stdout}${result.stderr}`);
  }
  return result;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {recursive: true, withFileTypes: true});
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(directory, resolve(entry.parentPath, entry.name)).replaceAll(
        '\\',
        '/',
      ),
    )
    .sort();
}
