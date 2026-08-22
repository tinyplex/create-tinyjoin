import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "dist/cli.js");
let output: string;

beforeEach(async () => {
  output = await mkdtemp(join(tmpdir(), "create-tinygres-cli-"));
});

afterEach(async () => {
  await rm(output, { force: true, recursive: true });
});

describe("create-tinygres CLI", () => {
  it("documents its automation surface", () => {
    const help = run(["--help"]);
    expect(help.stdout).toContain("TinyGres");
    expect(help.stdout).toContain("npm create tinygres@latest");
    expect(help.stdout).toContain("--non-interactive");
    expect(help.stdout).toContain("--storage opfs");

    const catalog = JSON.parse(run(["--list-options"]).stdout);
    expect(catalog.options).toEqual({
      projectName: { type: "string", required: true },
      storage: {
        values: ["opfs", "memory"],
        required: true,
        default: "opfs",
      },
      installAndRun: {
        values: [true, false],
        required: true,
        recommendedForAgents: false,
      },
    });
  }, 15_000);

  it("generates a flat, minimal in-memory todo starter", async () => {
    run(
      [
        "--non-interactive",
        "--projectName",
        "example",
        "--storage",
        "memory",
        "--installAndRun",
        "false",
      ],
      { CREATE_TINYGRES_DEPENDENCY: "9.9.9-test" },
    );

    const project = resolve(output, "example");
    expect(await listFiles(project)).toEqual([
      ".gitignore",
      "AGENTS.md",
      "README.md",
      "index.html",
      "package.json",
      "src/database.ts",
      "src/main.ts",
      "src/style.css",
      "tsconfig.json",
    ]);

    const manifest = JSON.parse(
      await readFile(resolve(project, "package.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      name: "example",
      private: true,
      dependencies: { tinygres: "9.9.9-test" },
    });

    const html = await readFile(resolve(project, "index.html"), "utf8");
    const readme = await readFile(resolve(project, "README.md"), "utf8");
    const agentInstructions = await readFile(
      resolve(project, "AGENTS.md"),
      "utf8",
    );
    const database = await readFile(
      resolve(project, "src/database.ts"),
      "utf8",
    );
    const source = await readFile(resolve(project, "src/main.ts"), "utf8");
    const style = await readFile(resolve(project, "src/style.css"), "utf8");

    expect(html).toContain("<h1>Todos</h1>");
    expect(html).toContain("starts fresh each time");
    expect(readme).toMatch(/needs no\s+database server/);
    expect(readme).not.toContain("cd client");
    expect(agentInstructions).toContain("src/database.ts");
    expect(`${html}\n${readme}\n${agentInstructions}`).not.toMatch(
      /worker|wasm|opfs|revision|invalidation|latency|benchmark/i,
    );

    expect(database).toContain("from 'tinygres'");
    expect(database).toContain("await create('memory://')");
    expect(database).toContain("CREATE TABLE IF NOT EXISTS todos");
    expect(database.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(source).toContain("crypto.randomUUID()");
    expect(source).toContain("INSERT INTO todos");
    expect(source).toContain("UPDATE todos SET done");
    expect(source).toContain("DELETE FROM todos");
    expect(source).toContain("database.subscribe(");
    expect(source).toContain("database.close()");
    expect(source).not.toMatch(
      /__tinygresDemo|performance\.now|JOIN|GROUP BY|revision|invalidation|latency|benchmark|transaction\(/i,
    );

    expect(lineCount(html)).toBeLessThanOrEqual(60);
    expect(lineCount(database)).toBeLessThanOrEqual(35);
    expect(lineCount(source)).toBeLessThanOrEqual(170);
    expect(lineCount(style)).toBeLessThanOrEqual(210);
    expect(
      lineCount(html) +
        lineCount(database) +
        lineCount(source) +
        lineCount(style),
    ).toBeLessThanOrEqual(460);
  });

  it("generates the same starter with data saved across reloads", async () => {
    run(
      [
        "--non-interactive",
        "--projectName",
        "saved-app",
        "--storage",
        "opfs",
        "--installAndRun",
        "false",
      ],
      { CREATE_TINYGRES_DEPENDENCY: "9.9.9-test" },
    );

    const project = resolve(output, "saved-app");
    const database = await readFile(
      resolve(project, "src/database.ts"),
      "utf8",
    );
    const html = await readFile(resolve(project, "index.html"), "utf8");
    const readme = await readFile(resolve(project, "README.md"), "utf8");

    expect(database).toContain(
      "await create('opfs://tinygres-saved-app-db-v1')",
    );
    expect(html).toContain("saved locally in this browser");
    expect(readme).toContain("remain after a reload");
    expect(`${html}\n${readme}`).not.toMatch(/worker|wasm|opfs/i);
  });

  it("rejects unsupported storage values", () => {
    const storage = run(
      [
        "--non-interactive",
        "--projectName",
        "bad-storage",
        "--storage",
        "indexeddb",
        "--installAndRun",
        "false",
      ],
      {},
      false,
    );
    expect(storage.status).not.toBe(0);
    expect(`${storage.stdout}${storage.stderr}`).toContain(
      "Storage must be one of: opfs, memory.",
    );
  });

  it("targets the published TinyGres release by default", async () => {
    run([
      "--non-interactive",
      "--projectName",
      "published",
      "--installAndRun",
      "false",
    ]);

    const manifest = JSON.parse(
      await readFile(resolve(output, "published/package.json"), "utf8"),
    );
    expect(manifest.dependencies.tinygres).toBe("^0.0.5");
  });

  it("rejects path-like and existing project names", async () => {
    expect(
      run(["--non-interactive", "--projectName", "../escape"], {}, false)
        .status,
    ).not.toBe(0);

    await mkdir(resolve(output, "existing"));
    const existing = run(
      ["--non-interactive", "--projectName", "existing"],
      {},
      false,
    );
    expect(existing.status).not.toBe(0);
    expect(`${existing.stdout}${existing.stderr}`).toContain("already exists");
  });

  it("builds a public generator package under dist", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(root, "dist/package.json"), "utf8"),
    );
    expect(manifest.private).toBeUndefined();
    expect(manifest.scripts).toBeUndefined();
    expect(manifest.devDependencies).toBeUndefined();
    expect(manifest.description).toContain("TinyGres");
    expect(manifest.bin).toEqual({ "create-tinygres": "cli.js" });
    expect(manifest.files).toContain("templates");
  });
});

function run(
  args: string[],
  environment: Record<string, string> = {},
  expectSuccess = true,
) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: output,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  if (expectSuccess && result.status !== 0) {
    throw new Error(`${result.stdout}${result.stderr}`);
  }
  return result;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(directory, resolve(entry.parentPath, entry.name)).replaceAll(
        "\\",
        "/",
      ),
    )
    .sort();
}

function lineCount(value: string): number {
  return value.trimEnd().split("\n").length;
}
