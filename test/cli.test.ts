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
    expect(help.stdout).toContain("--adapter sample --storage memory");
    expect(help.stdout).toContain("--adapter supabase --storage opfs");
    expect(help.stdout).toContain("--supabaseUrl");
    expect(help.stdout).toContain("--supabasePublishableKey");

    const catalog = JSON.parse(run(["--list-options"]).stdout);
    expect(catalog.options).toEqual({
      projectName: { type: "string", required: true },
      adapter: {
        values: ["sample", "supabase"],
        required: true,
        default: "sample",
      },
      storage: {
        values: ["memory", "opfs"],
        required: true,
        default: "memory",
      },
      supabaseUrl: {
        type: "string",
        requiredWhen: { adapter: "supabase" },
      },
      supabasePublishableKey: {
        type: "string",
        requiredWhen: { adapter: "supabase" },
        sensitive: true,
      },
      installAndRun: {
        values: [true, false],
        required: true,
        recommendedForAgents: false,
      },
    });
  });

  it("generates the TinyGres starter without duplicating a built demo", async () => {
    run(
      [
        "--non-interactive",
        "--projectName",
        "example",
        "--installAndRun",
        "false",
      ],
      { CREATE_TINYGRES_DEPENDENCY: "9.9.9-test" },
    );

    const project = resolve(output, "example");
    expect(await listFiles(project)).toEqual([
      "AGENTS.md",
      "README.md",
      "client/.gitignore",
      "client/index.html",
      "client/package.json",
      "client/src/main.ts",
      "client/src/style.css",
      "client/src/vite-env.d.ts",
      "client/tsconfig.json",
    ]);

    const manifest = JSON.parse(
      await readFile(resolve(project, "client/package.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      name: "example-client",
      private: true,
      dependencies: { tinygres: "9.9.9-test" },
    });

    const html = await readFile(resolve(project, "client/index.html"), "utf8");
    expect(html).toContain("<h1>TinyGres</h1>");

    const source = await readFile(
      resolve(project, "client/src/main.ts"),
      "utf8",
    );
    expect(source).toContain("from 'tinygres'");
    expect(source).toContain("createClient");
    expect(source).toContain("database.applyBatch(batch)");
    expect(source).not.toContain("../src");
    expect(source).not.toContain("storage: {kind: 'opfs'");
    expect(source).not.toContain("VITE_SUPABASE");
  });

  it("generates a Supabase and OPFS starter with local configuration", async () => {
    const publishableKey = "sb_publishable_test-key_123";
    run(
      [
        "--non-interactive",
        "--projectName",
        "supabase-app",
        "--adapter",
        "supabase",
        "--storage",
        "opfs",
        "--supabaseUrl",
        "https://Example.Supabase.co/?discard=true#fragment",
        "--supabasePublishableKey",
        publishableKey,
        "--installAndRun",
        "false",
      ],
      { CREATE_TINYGRES_DEPENDENCY: "9.9.9-test" },
    );

    const project = resolve(output, "supabase-app");
    expect(await listFiles(project)).toEqual([
      "AGENTS.md",
      "README.md",
      "client/.env.example",
      "client/.env.local",
      "client/.gitignore",
      "client/index.html",
      "client/package.json",
      "client/src/main.ts",
      "client/src/style.css",
      "client/src/vite-env.d.ts",
      "client/tsconfig.json",
      "supabase.sql",
    ]);

    const environment = await readFile(
      resolve(project, "client/.env.local"),
      "utf8",
    );
    expect(environment).toBe(
      `VITE_SUPABASE_URL="https://example.supabase.co/"\nVITE_SUPABASE_PUBLISHABLE_KEY="${publishableKey}"\n`,
    );

    const exampleEnvironment = await readFile(
      resolve(project, "client/.env.example"),
      "utf8",
    );
    expect(exampleEnvironment).not.toContain(publishableKey);

    const source = await readFile(
      resolve(project, "client/src/main.ts"),
      "utf8",
    );
    expect(source).toContain("kind: 'supabase'");
    expect(source).toContain("import.meta.env.VITE_SUPABASE_URL");
    expect(source).toContain(
      "storage: {kind: 'opfs', name: 'tinygres-supabase-app-posts-v1'}",
    );
    expect(source).not.toContain(publishableKey);

    const setup = await readFile(resolve(project, "supabase.sql"), "utf8");
    expect(setup).toContain("create table public.tinygres_posts");
    expect(setup).toContain(
      "public.tinygres_posts already exists and is not owned by create-tinygres",
    );
    expect(setup).toContain(
      "create-tinygres:v1 disposable public demo table",
    );
    expect(setup).toContain("to anon");
  });

  it("accepts browser-safe publishable credentials and loopback development URLs", async () => {
    const anonKey = legacyJwt("anon");
    run([
      "--non-interactive",
      "--projectName",
      "loopback",
      "--adapter",
      "supabase",
      "--storage",
      "memory",
      "--supabaseUrl",
      "http://127.0.0.1:54321/",
      "--supabasePublishableKey",
      anonKey,
      "--installAndRun",
      "false",
    ]);

    const environment = await readFile(
      resolve(output, "loopback/client/.env.local"),
      "utf8",
    );
    expect(environment).toContain(
      'VITE_SUPABASE_URL="http://127.0.0.1:54321/"',
    );
    expect(environment).toContain(`VITE_SUPABASE_PUBLISHABLE_KEY="${anonKey}"`);
  });

  it("requires Supabase configuration in non-interactive mode", () => {
    const missingUrl = run(
      [
        "--non-interactive",
        "--projectName",
        "missing-url",
        "--adapter",
        "supabase",
        "--storage",
        "memory",
        "--installAndRun",
        "false",
      ],
      {},
      false,
    );
    expect(missingUrl.status).not.toBe(0);
    expect(`${missingUrl.stdout}${missingUrl.stderr}`).toContain(
      "A Supabase URL is required",
    );

    const missingKey = run(
      [
        "--non-interactive",
        "--projectName",
        "missing-key",
        "--adapter",
        "supabase",
        "--storage",
        "memory",
        "--supabaseUrl",
        "https://example.supabase.co",
        "--installAndRun",
        "false",
      ],
      {},
      false,
    );
    expect(missingKey.status).not.toBe(0);
    expect(`${missingKey.stdout}${missingKey.stderr}`).toContain(
      "A Supabase publishable key is required",
    );
  });

  it("rejects unsafe Supabase configuration without echoing credentials", () => {
    const unsafeInputs = [
      {
        name: "plaintext HTTP",
        url: "http://remote.example.com/private-path",
        key: "sb_publishable_safe-test",
      },
      {
        name: "URL credentials",
        url: "https://admin:do-not-echo@example.supabase.co",
        key: "sb_publishable_safe-test",
      },
      {
        name: "CRLF URL",
        url: "https://example.supabase.co/\r\ndo-not-echo",
        key: "sb_publishable_safe-test",
      },
      {
        name: "secret key",
        url: "https://example.supabase.co",
        key: "sb_secret_do-not-echo",
      },
      {
        name: "service role JWT",
        url: "https://example.supabase.co",
        key: legacyJwt("service_role"),
      },
    ];

    for (const [index, unsafe] of unsafeInputs.entries()) {
      const result = run(
        [
          "--non-interactive",
          "--projectName",
          `unsafe-${index}`,
          "--adapter",
          "supabase",
          "--storage",
          "memory",
          "--supabaseUrl",
          unsafe.url,
          "--supabasePublishableKey",
          unsafe.key,
          "--installAndRun",
          "false",
        ],
        {},
        false,
      );
      const diagnostic = `${result.stdout}${result.stderr}`;
      expect(result.status, unsafe.name).not.toBe(0);
      expect(diagnostic, unsafe.name).not.toContain(unsafe.url);
      expect(diagnostic, unsafe.name).not.toContain(unsafe.key);
    }
  });

  it("rejects unsupported adapter and storage values", () => {
    const adapter = run(
      [
        "--non-interactive",
        "--projectName",
        "bad-adapter",
        "--adapter",
        "postgres",
        "--storage",
        "memory",
        "--installAndRun",
        "false",
      ],
      {},
      false,
    );
    expect(adapter.status).not.toBe(0);
    expect(`${adapter.stdout}${adapter.stderr}`).toContain(
      "Adapter must be one of: sample, supabase.",
    );

    const storage = run(
      [
        "--non-interactive",
        "--projectName",
        "bad-storage",
        "--adapter",
        "sample",
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
      "Storage must be one of: memory, opfs.",
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
      await readFile(resolve(output, "published/client/package.json"), "utf8"),
    );
    expect(manifest.dependencies.tinygres).toBe("^0.0.3");
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

function legacyJwt(role: "anon" | "service_role"): string {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    Buffer.from("test-signature").toString("base64url"),
  ].join(".");
}
