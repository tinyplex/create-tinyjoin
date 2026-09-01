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
const tinyjoinRoot = resolve(root, "../tinyjoin");
const output = generatedTestRoot;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
let tinyjoinDependency: string;

beforeAll(async () => {
  await rm(output, { force: true, recursive: true });
  await mkdir(output, { recursive: true });
  tinyjoinDependency =
    process.env.CREATE_TINYJOIN_DEPENDENCY ?? (await packSiblingTinyJoin());
});

describe.sequential("generated apps", () => {
  it("builds saved and fresh todo starters against current TinyJoin", async () => {
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
    expect(database).toContain("await create('opfs://tinyjoin-app-db-v1')");
    expect(database).toContain("CREATE TABLE IF NOT EXISTS todos");
    expect(source).toContain("crypto.randomUUID()");
    expect(source).toContain("INSERT INTO todos");
    expect(source).toContain("UPDATE todos SET done");
    expect(source).toContain("DELETE FROM todos");
    expect(source).toContain("database.subscribe(");
    expect(source).toContain("database.close()");
    expect(source).not.toMatch(
      /__tinyjoinDemo|performance\.now|JOIN|GROUP BY|revision|invalidation|latency|benchmark|transaction\(/i,
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
    { CREATE_TINYJOIN_DEPENDENCY: tinyjoinDependency },
  );
}

async function installBuildAndCheck(app: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(app, "package.json"), "utf8"),
  );
  expect(manifest.dependencies.tinyjoin).toBe(tinyjoinDependency);

  run(npm, ["install", "--no-audit", "--no-fund"], app);
  expect(
    (await lstat(resolve(app, "node_modules/tinyjoin"))).isSymbolicLink(),
  ).toBe(false);
  const installedManifest = JSON.parse(
    await readFile(resolve(app, "node_modules/tinyjoin/package.json"), "utf8"),
  );
  expect(installedManifest).toMatchObject({
    name: "tinyjoin",
    version: "0.0.5",
  });

  run(npm, ["run", "build"], app);

  const assets = await readdir(resolve(app, "dist/assets"));
  expect(assets.some((file) => file.endsWith(".wasm"))).toBe(true);
}

async function packSiblingTinyJoin(): Promise<string> {
  if (!existsSync(resolve(tinyjoinRoot, "package.json"))) {
    throw new Error(
      "Set CREATE_TINYJOIN_DEPENDENCY to a packed TinyJoin 0.0.5 package, or check out TinyJoin beside create-tinyjoin.",
    );
  }

  run(npm, ["run", "build"], tinyjoinRoot);
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
      tinyjoinRoot,
    ),
  ) as Array<{ filename?: unknown; version?: unknown }>;
  const packageResult = packed[0];
  if (
    packageResult?.version !== "0.0.5" ||
    typeof packageResult.filename !== "string"
  ) {
    throw new Error("Sibling TinyJoin must pack as version 0.0.5");
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
