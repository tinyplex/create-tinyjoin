import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { generatedApp, generatedApps, generatedTestRoot } from "./paths.js";
import type { GeneratedApp } from "./paths.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = generatedTestRoot;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const tinyjoinDependency = process.env.CREATE_TINYJOIN_DEPENDENCY ?? "^0.0.6";

beforeAll(async () => {
  await rm(output, { force: true, recursive: true });
  await mkdir(output, { recursive: true });
});

describe.sequential("generated apps", () => {
  it("builds every language and storage combination against published TinyJoin", async () => {
    generatedApps.forEach(generate);

    const saved = generatedApp("app");
    const database = await read(saved, "database");
    const todoInput = await read(saved, "todoInput");
    const todoList = await read(saved, "todoList");
    expect(database).toContain(
      "export const DATA_DIR = 'opfs://tinyjoin-app-db-v2'",
    );
    expect(database).toContain("CREATE TABLE IF NOT EXISTS todos");
    expect(database).toContain("database.close()");
    expect(todoInput).toContain("crypto.randomUUID()");
    expect(todoInput).toContain("INSERT INTO todos");
    expect(todoList).toContain("UPDATE todos SET completed = $1 WHERE id = $2");
    expect(todoList).toContain("DELETE FROM todos WHERE id = $1");
    expect(todoList).toContain("database.subscribe(");
    expect(`${database}\n${todoInput}\n${todoList}`).not.toMatch(
      /__tinyjoinDemo|performance\.now|\bjoin\b|group by|revision|invalidation|latency|benchmark|transaction\(/i,
    );

    expect(await read(generatedApp("fresh-app"), "database")).toContain(
      "export const DATA_DIR = 'memory://'",
    );

    // The JavaScript starters are the same sources with their types removed.
    const javascriptDatabase = await read(generatedApp("js-app"), "database");
    expect(javascriptDatabase).toContain("import {create, ClientError} from 'tinyjoin'");
    expect(javascriptDatabase).not.toMatch(/:\s*Promise<|export type /);
    expect(javascriptDatabase).toContain("await create(DATA_DIR)");

    for (const app of generatedApps) {
      await installBuildAndCheck(app);
    }
  }, 480_000);
});

function generate({ name, language, storage }: GeneratedApp): void {
  run(
    process.execPath,
    [
      resolve(root, "dist/cli.js"),
      "--non-interactive",
      "--projectName",
      name,
      "--language",
      language,
      "--storage",
      storage,
      "--installAndRun",
      "false",
    ],
    output,
    { CREATE_TINYJOIN_DEPENDENCY: tinyjoinDependency },
  );
}

function read({ path, ext }: GeneratedApp, module: string): Promise<string> {
  return readFile(resolve(path, `src/${module}.${ext}`), "utf8");
}

async function installBuildAndCheck(app: GeneratedApp): Promise<void> {
  const { path, language } = app;
  const manifest = JSON.parse(
    await readFile(resolve(path, "package.json"), "utf8"),
  );
  expect(manifest.dependencies.tinyjoin).toBe(tinyjoinDependency);
  expect(manifest.scripts.build).toBe(
    language === "typescript" ? "tsc --noEmit && vite build" : "vite build",
  );
  expect(manifest.devDependencies.typescript).toBe(
    language === "typescript" ? "^7.0.2" : undefined,
  );

  run(npm, ["install", "--no-audit", "--no-fund"], path);
  const lock = JSON.parse(
    await readFile(resolve(path, "package-lock.json"), "utf8"),
  );
  const lockedTinyJoin = lock.packages?.["node_modules/tinyjoin"];
  expect(lockedTinyJoin).toMatchObject({ version: "0.0.6" });
  if (process.env.CREATE_TINYJOIN_DEPENDENCY === undefined) {
    expect(lockedTinyJoin.resolved).toBe(
      "https://registry.npmjs.org/tinyjoin/-/tinyjoin-0.0.6.tgz",
    );
  }
  expect(
    (await lstat(resolve(path, "node_modules/tinyjoin"))).isSymbolicLink(),
  ).toBe(false);
  const installedManifest = JSON.parse(
    await readFile(resolve(path, "node_modules/tinyjoin/package.json"), "utf8"),
  );
  expect(installedManifest).toMatchObject({
    name: "tinyjoin",
    version: "0.0.6",
  });

  run(npm, ["run", "build"], path);

  const assets = await readdir(resolve(path, "dist/assets"));
  expect(assets.some((file) => file.endsWith(".wasm"))).toBe(true);
}

function run(
  command: string,
  args: string[],
  cwd: string,
  environment: Record<string, string> = {},
): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}:\n${result.stdout}${result.stderr}`,
    );
  }
  return result.stdout;
}
