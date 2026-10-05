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
const tinyjoinDependency = process.env.CREATE_TINYJOIN_DEPENDENCY ?? "^0.5.0";

beforeAll(async () => {
  await rm(output, { force: true, recursive: true });
  await mkdir(output, { recursive: true });
});

describe("generated apps", { concurrent: false }, () => {
  it("builds every language, query, and storage combination against published TinyJoin", async () => {
    generatedApps.forEach(generate);

    const saved = generatedApp("app");
    const database = await read(saved, "database");
    const todos = await read(saved, "todos");
    const todoInput = await read(saved, "todoInput");
    const todoList = await read(saved, "todoList");
    expect(database).toContain(
      "export const DATA_DIR = 'opfs://tinyjoin-app-db-v3'",
    );
    expect(database).toContain("await initializeTodos(database)");
    expect(database).toContain("database.close()");
    expect(todos).toContain("CREATE TABLE todos");
    expect(todos).toContain("TABLE_ALREADY_EXISTS");
    expect(todos).toContain("crypto.randomUUID()");
    expect(todos).toContain("INSERT INTO todos");
    expect(todos).toContain("UPDATE todos SET completed = $1 WHERE id = $2");
    expect(todos).toContain("DELETE FROM todos WHERE id = $1");
    expect(todos).toContain("database.subscribe(");
    expect(todoInput).toContain("todos.add(text)");
    expect(todoList).toContain("todos.subscribe(");
    expect(`${database}\n${todos}\n${todoInput}\n${todoList}`).not.toMatch(
      /__tinyjoinDemo|performance\.now|\bjoin\b|group by|revision|invalidation|latency|benchmark|transaction\(/i,
    );

    expect(await read(generatedApp("fresh-app"), "database")).toContain(
      "export const DATA_DIR = 'memory://'",
    );

    // The JavaScript starters are the same sources with their types removed.
    const javascriptDatabase = await read(generatedApp("js-app"), "database");
    expect(javascriptDatabase).toContain("import {create} from 'tinyjoin'");
    expect(javascriptDatabase).not.toMatch(/:\s*Promise<|export type /);
    expect(javascriptDatabase).toContain("await create(DATA_DIR)");
    expect(await read(generatedApp("js-app"), "todos")).toContain(
      "import {ClientError} from 'tinyjoin'",
    );

    // The query builders' todos modules run the same operations.
    const drizzle = await read(generatedApp("drizzle-app"), "todos");
    expect(drizzle).toContain("await push(db, schema)");
    expect(drizzle).toContain("db.insert(todos)");
    expect(await read(generatedApp("drizzle-app"), "schema")).toContain(
      "pgTable('todos'",
    );
    const kysely = await read(generatedApp("kysely-app"), "todos");
    expect(kysely).toContain("new Migrator(");
    expect(kysely).toContain(".insertInto('todos')");
    for (const name of ["drizzle-app", "kysely-app"]) {
      expect(await read(generatedApp(name), "todoList")).toBe(todoList);
      expect(await read(generatedApp(name), "database")).toBe(
        database.replace("tinyjoin-app-db-v3", `tinyjoin-${name}-db-v3`),
      );
    }

    for (const app of generatedApps) {
      await installBuildAndCheck(app);
    }
  }, 600_000);
});

function generate({ name, language, queries, storage }: GeneratedApp): void {
  run(
    process.execPath,
    [
      resolve(root, "dist/cli.js"),
      "--non-interactive",
      "--projectName",
      name,
      "--language",
      language,
      "--queries",
      queries,
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

const QUERY_DEPENDENCIES = {
  sql: {},
  drizzle: { "drizzle-orm": "^0.45.3" },
  kysely: { kysely: "^0.29.6" },
};

async function installBuildAndCheck(app: GeneratedApp): Promise<void> {
  const { path, language, queries } = app;
  const manifest = JSON.parse(
    await readFile(resolve(path, "package.json"), "utf8"),
  );
  expect(manifest.dependencies).toEqual({
    ...QUERY_DEPENDENCIES[queries],
    tinyjoin: tinyjoinDependency,
  });
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
  expect(lockedTinyJoin).toMatchObject({ version: "0.5.0" });
  if (process.env.CREATE_TINYJOIN_DEPENDENCY === undefined) {
    expect(lockedTinyJoin.resolved).toBe(
      "https://registry.npmjs.org/tinyjoin/-/tinyjoin-0.5.0.tgz",
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
    version: "0.5.0",
  });
  run(npm, ["run", "build"], path);

  const assets = await readdir(resolve(path, "dist/assets"));
  expect(assets.some((file) => file.endsWith(".wasm"))).toBe(true);
  const offline = JSON.parse(
    await readFile(resolve(path, "dist/tinyjoin-precache.json"), "utf8"),
  ) as { assets: { url: string; revision: string }[] };
  const cachedUrls = offline.assets.map(({ url }) => url);
  expect(cachedUrls).toContain("index.html");
  expect(cachedUrls).toContain("favicon.svg");
  expect(cachedUrls).toContain("tinyjoin-register.js");
  for (const file of assets) {
    expect(cachedUrls).toContain(`assets/${file}`);
  }
  expect(
    await readFile(resolve(path, "dist/tinyjoin-sw.js"), "utf8"),
  ).toContain("tinyjoin-precache.js");
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
