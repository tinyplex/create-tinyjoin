import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generatedMemoryClient,
  generatedOpfsClient,
  generatedTestRoot,
} from "./paths.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tinygresRoot = resolve(root, "../tinygres");
const output = generatedTestRoot;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
let tinygresDependency: string;

beforeAll(async () => {
  await rm(output, { force: true, recursive: true });
  await mkdir(output, { recursive: true });
  tinygresDependency =
    process.env.CREATE_TINYGRES_DEPENDENCY ?? (await packSiblingTinygres());
});

describe.sequential("generated apps", () => {
  it("builds the memory and OPFS demos against current TinyGres", async () => {
    generate("app", "opfs");
    generate("memory-app", "memory");

    const source = await readFile(
      resolve(generatedOpfsClient, "src/main.ts"),
      "utf8",
    );
    expect(source).toContain(
      "await create('opfs://tinygres-app-db-v1')",
    );
    expect(source).toContain(
      "type Database = Awaited<ReturnType<typeof create>>",
    );
    expect(source).toContain("database.exec(");
    expect(source).toContain("schemaStatements.join(';\\n')");
    expect(source).toContain("database.query<");
    expect(source).toContain("database.query<TaskRow>(TASK_QUERY, [1])");
    expect(source).toContain("await transaction.query(");
    expect(source).toContain(
      "await database.query('UPDATE tasks SET done = $1 WHERE id = $2'",
    );
    expect(source).toContain("database.transaction(");
    expect(source).toContain("database.subscribe(");
    expect(source).toContain("database.close()");
    expect(source).toContain("JOIN task_tags");
    expect(source).toContain("JOIN tags");
    expect(source).not.toContain("database.ready()");
    expect(source).not.toContain("database.exec('UPDATE tasks SET done");
    expect(source).not.toContain("storage:");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("replaceTable");
    expect(source).not.toContain("applyBatch");
    expect(source).not.toMatch(/supabase/i);

    const memorySource = await readFile(
      resolve(generatedMemoryClient, "src/main.ts"),
      "utf8",
    );
    expect(memorySource).toContain("await create('memory://')");
    expect(memorySource).not.toContain("storage:");
    expect(memorySource).toContain("database.transaction(");
    expect(memorySource).toContain("JOIN task_tags");
    expect(memorySource).toContain("JOIN tags");
    expect(memorySource).toContain("memory database starts fresh");

    await installBuildAndCheck(generatedOpfsClient);
    await installBuildAndCheck(generatedMemoryClient);
  }, 240_000);
});

function generate(projectName: string, storage: "memory" | "opfs"): void {
  run(
    process.execPath,
    [
      resolve(root, "dist/cli.js"),
      "--non-interactive",
      "--projectName",
      projectName,
      "--storage",
      storage,
      "--installAndRun",
      "false",
    ],
    output,
    { CREATE_TINYGRES_DEPENDENCY: tinygresDependency },
  );
}

async function installBuildAndCheck(client: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(client, "package.json"), "utf8"),
  );
  expect(manifest.dependencies.tinygres).toBe(tinygresDependency);

  run(npm, ["install", "--no-audit", "--no-fund"], client);
  expect(
    (await lstat(resolve(client, "node_modules/tinygres"))).isSymbolicLink(),
  ).toBe(false);
  const installedManifest = JSON.parse(
    await readFile(
      resolve(client, "node_modules/tinygres/package.json"),
      "utf8",
    ),
  );
  expect(installedManifest).toMatchObject({
    name: "tinygres",
    version: "0.0.5",
  });

  run(npm, ["run", "build"], client);

  const assets = await readdir(resolve(client, "dist/assets"));
  expect(assets.some((file) => file.endsWith(".wasm"))).toBe(true);
}

async function packSiblingTinygres(): Promise<string> {
  if (!existsSync(resolve(tinygresRoot, "package.json"))) {
    throw new Error(
      "Set CREATE_TINYGRES_DEPENDENCY to a packed TinyGres 0.0.5 package, or check out TinyGres beside create-tinygres.",
    );
  }

  run(npm, ["run", "build"], tinygresRoot);
  const packages = resolve(output, "packages");
  await mkdir(packages, { recursive: true });
  const packed = JSON.parse(
    run(
      npm,
      [
        "pack",
        "./dist",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        packages,
      ],
      tinygresRoot,
    ),
  ) as Array<{ filename?: unknown; version?: unknown }>;
  const packageResult = packed[0];
  if (
    packageResult?.version !== "0.0.5" ||
    typeof packageResult.filename !== "string"
  ) {
    throw new Error("Sibling TinyGres must pack as version 0.0.5");
  }
  return pathToFileURL(resolve(packages, packageResult.filename)).href;
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
