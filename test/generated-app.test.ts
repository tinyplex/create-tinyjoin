import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generatedSampleClient,
  generatedSupabaseClient,
  generatedTestRoot,
} from "./paths.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = generatedTestRoot;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const supabaseUrl = "http://127.0.0.1:4176";
const supabasePublishableKey = "sb_publishable_create_tinygres_e2e";

beforeAll(async () => {
  await rm(output, { force: true, recursive: true });
  await mkdir(output, { recursive: true });
});

describe.sequential("generated apps", () => {
  it("builds the sample app against the published TinyGres package", async () => {
    generate([
      "--projectName",
      "app",
      "--adapter",
      "sample",
      "--storage",
      "opfs",
    ]);
    generate([
      "--projectName",
      "sample-memory-app",
      "--adapter",
      "sample",
      "--storage",
      "memory",
    ]);

    await installBuildAndCheck(generatedSampleClient);
    await installBuildAndCheck(resolve(output, "sample-memory-app/client"));
  }, 180_000);

  it("builds the Supabase OPFS app against the published TinyGres package", async () => {
    generate([
      "--projectName",
      "supabase-app",
      "--adapter",
      "supabase",
      "--storage",
      "opfs",
      "--supabaseUrl",
      supabaseUrl,
      "--supabasePublishableKey",
      supabasePublishableKey,
    ]);
    generate([
      "--projectName",
      "supabase-memory-app",
      "--adapter",
      "supabase",
      "--storage",
      "memory",
      "--supabaseUrl",
      supabaseUrl,
      "--supabasePublishableKey",
      supabasePublishableKey,
    ]);

    const source = await readFile(
      resolve(generatedSupabaseClient, "src/main.ts"),
      "utf8",
    );
    const environment = await readFile(
      resolve(generatedSupabaseClient, ".env.local"),
      "utf8",
    );
    const environmentExample = await readFile(
      resolve(generatedSupabaseClient, ".env.example"),
      "utf8",
    );
    const gitignore = await readFile(
      resolve(generatedSupabaseClient, ".gitignore"),
      "utf8",
    );
    const readme = await readFile(
      resolve(generatedTestRoot, "supabase-app/README.md"),
      "utf8",
    );
    const setupSql = await readFile(
      resolve(generatedTestRoot, "supabase-app/supabase.sql"),
      "utf8",
    );
    expect(source).toMatch(/storage:\s*\{\s*kind:\s*['"]opfs['"]/);
    expect(source).toContain("tinygres_posts");
    expect(source).not.toContain(supabaseUrl);
    expect(source).not.toContain(supabasePublishableKey);
    expect(environment).toContain(
      `VITE_SUPABASE_URL=${JSON.stringify(new URL(supabaseUrl).href)}`,
    );
    expect(environment).toContain(
      `VITE_SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(supabasePublishableKey)}`,
    );
    expect(environmentExample).not.toContain(supabaseUrl);
    expect(environmentExample).not.toContain(supabasePublishableKey);
    expect(gitignore.split(/\r?\n/)).toContain(".env.local");
    expect(readme).not.toContain(supabaseUrl);
    expect(readme).not.toContain(supabasePublishableKey);
    expect(setupSql).toMatch(
      /alter table public\.tinygres_posts replica identity full/i,
    );
    expect(setupSql).toContain(
      "public.tinygres_posts already exists and is not owned by create-tinygres",
    );
    expect(setupSql).toContain(
      "create-tinygres:v1 disposable public demo table",
    );
    expect(setupSql).toMatch(
      /alter publication supabase_realtime add table public\.tinygres_posts/i,
    );
    expect(setupSql).toMatch(/using \(true\)/i);

    await installBuildAndCheck(generatedSupabaseClient);
    await installBuildAndCheck(resolve(output, "supabase-memory-app/client"));
  }, 180_000);
});

function generate(options: string[]): void {
  run(
    npm,
    [
      "--prefix",
      root,
      "run",
      "local",
      "--",
      "--non-interactive",
      ...options,
      "--installAndRun",
      "false",
    ],
    output,
  );
}

async function installBuildAndCheck(client: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(client, "package.json"), "utf8"),
  );
  expect(manifest.dependencies.tinygres).toBe("^0.0.3");

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
  expect(installedManifest.name).toBe("tinygres");
  expect(installedManifest.version).toBe("0.0.3");

  run(npm, ["run", "build"], client);

  const assets = await readdir(resolve(client, "dist/assets"));
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
