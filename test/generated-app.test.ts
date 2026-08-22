import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generatedFreshApp,
  generatedSavedApp,
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
  it("builds saved and fresh todo starters against current TinyGres", async () => {
    generate("app", "opfs");
    generate("fresh-app", "memory");

    const database = await readFile(
      resolve(generatedSavedApp, "src/database.ts"),
      "utf8",
    );
    const source = await readFile(
      resolve(generatedSavedApp, "src/main.ts"),
      "utf8",
    );
    expect(database).toContain("await create('opfs://tinygres-app-db-v1')");
    expect(database).toContain("CREATE TABLE IF NOT EXISTS todos");
    expect(source).toContain("crypto.randomUUID()");
    expect(source).toContain("INSERT INTO todos");
    expect(source).toContain("UPDATE todos SET done");
    expect(source).toContain("DELETE FROM todos");
    expect(source).toContain("database.subscribe(");
    expect(source).toContain("database.close()");
    expect(source).not.toMatch(
      /__tinygresDemo|performance\.now|JOIN|GROUP BY|revision|invalidation|latency|benchmark|transaction\(/i,
    );

    const freshDatabase = await readFile(
      resolve(generatedFreshApp, "src/database.ts"),
      "utf8",
    );
    expect(freshDatabase).toContain("await create('memory://')");

    await installBuildAndCheck(generatedSavedApp);
    await installBuildAndCheck(generatedFreshApp);
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

async function installBuildAndCheck(app: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(app, "package.json"), "utf8"),
  );
  expect(manifest.dependencies.tinygres).toBe(tinygresDependency);

  run(npm, ["install", "--no-audit", "--no-fund"], app);
  expect(
    (await lstat(resolve(app, "node_modules/tinygres"))).isSymbolicLink(),
  ).toBe(false);
  const installedManifest = JSON.parse(
    await readFile(resolve(app, "node_modules/tinygres/package.json"), "utf8"),
  );
  expect(installedManifest).toMatchObject({
    name: "tinygres",
    version: "0.0.5",
  });

  run(npm, ["run", "build"], app);

  const assets = await readdir(resolve(app, "dist/assets"));
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
