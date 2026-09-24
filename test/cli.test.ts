import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "dist/cli.js");
let output: string;

type Language = "typescript" | "javascript";
type Storage = "opfs" | "memory";

const LANGUAGES: { language: Language; ext: "ts" | "js"; icon: string }[] = [
  { language: "typescript", ext: "ts", icon: "ts.svg" },
  { language: "javascript", ext: "js", icon: "js.svg" },
];

const SCRIPT_MODULES = [
  "app",
  "button",
  "database",
  "error",
  "index",
  "info",
  "input",
  "loading",
  "title",
  "todoInput",
  "todoItem",
  "todoList",
  "topBar",
];

const STYLE_MODULES = [
  "button",
  "error",
  "info",
  "input",
  "loading",
  "title",
  "todoInput",
  "todoItem",
  "todoList",
  "topBar",
];

function expectedFiles(language: Language): string[] {
  const { ext, icon } = LANGUAGES.find(
    (candidate) => candidate.language === language,
  )!;
  return [
    ".gitignore",
    "AGENTS.md",
    "README.md",
    "index.html",
    "package.json",
    `vite.config.${ext}`,
    "public/favicon.svg",
    `public/${icon}`,
    ...SCRIPT_MODULES.map((module) => `src/${module}.${ext}`),
    ...STYLE_MODULES.map((module) => `src/${module}.css`),
    ...(language === "typescript" ? ["tsconfig.json"] : []),
  ].sort();
}

beforeEach(async () => {
  output = await mkdtemp(join(tmpdir(), "create-tinyjoin-cli-"));
});

afterEach(async () => {
  await rm(output, { force: true, recursive: true });
});

describe("create-tinyjoin CLI", () => {
  it("documents its automation surface", () => {
    const help = run(["--help"]);
    expect(help.stdout).toContain("TinyJoin");
    expect(help.stdout).toContain("npm create tinyjoin@latest");
    expect(help.stdout).toContain("--non-interactive");
    expect(help.stdout).toContain("--language typescript");
    expect(help.stdout).toContain("--storage opfs");

    const catalog = JSON.parse(run(["--list-options"]).stdout);
    expect(catalog.options).toEqual({
      projectName: { type: "string", required: true },
      language: {
        values: ["typescript", "javascript"],
        required: true,
        default: "typescript",
      },
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

  it("defaults to TypeScript when no language is chosen", async () => {
    run([
      "--non-interactive",
      "--projectName",
      "defaulted",
      "--installAndRun",
      "false",
    ]);
    expect(await listFiles(resolve(output, "defaulted"))).toEqual(
      expectedFiles("typescript"),
    );
  });

  for (const { language, ext } of LANGUAGES) {
    describe(language, () => {
      it("generates a flat, in-memory todo starter", async () => {
        generate("example", language, "memory");

        const project = resolve(output, "example");
        expect(await listFiles(project)).toEqual(expectedFiles(language));

        const manifest = JSON.parse(
          await readFile(resolve(project, "package.json"), "utf8"),
        );
        expect(manifest).toMatchObject({
          name: "example",
          private: true,
          engines: { node: "^20.19.0 || >=22.12.0" },
          dependencies: { tinyjoin: "9.9.9-test" },
        });
        expect(manifest.scripts.build).toBe(
          language === "typescript"
            ? "tsc --noEmit && vite build"
            : "vite build",
        );
        expect(manifest.devDependencies.typescript).toBe(
          language === "typescript" ? "^7.0.2" : undefined,
        );

        const html = await read(project, "index.html");
        const readme = await read(project, "README.md");
        const agentInstructions = await read(project, "AGENTS.md");
        const database = await read(project, `src/database.${ext}`);
        const vite = await read(project, `vite.config.${ext}`);

        expect(html).toContain("<title>TinyJoin Todos</title>");
        expect(html).toContain("--accent: #7c3aed;");
        expect(html).toContain('<div id="root"></div>');
        expect(html).toContain(`src="/src/index.${ext}"`);
        expect(html).not.toMatch(/https?:\/\//);
        expect(vite).toContain("from 'tinyjoin/vite'");
        expect(vite).toContain("plugins: [tinyjoinOffline()]");
        expect(readme).toMatch(/needs no\s+database server/);
        expect(readme).toContain("start fresh after a reload");
        expect(readme).toContain(`src/database.${ext}`);
        expect(readme).not.toContain("cd client");
        expect(agentInstructions).toContain(`src/database.${ext}`);
        expect(`${html}\n${readme}\n${agentInstructions}`).not.toMatch(
          /wasm|opfs|revision|invalidation|latency|benchmark/i,
        );
        expect(readme).toContain("## Offline Use");
        expect(readme).toContain("npm run preview");

        expect(database).toContain("from 'tinyjoin'");
        expect(database).toContain("await create(DATA_DIR)");
        expect(database).toContain("export const DATA_DIR = 'memory://'");
        expect(database).toContain("CREATE TABLE todos");
        expect(database).toContain("TABLE_ALREADY_EXISTS");
        expect(database.match(/CREATE TABLE/g)).toHaveLength(1);
      });

      it("keeps the TinyBase starter's markup and styles with local fonts and accent", async () => {
        generate("styled", language, "memory");
        const project = resolve(output, "styled");

        const todoItem = await read(project, `src/todoItem.${ext}`);
        expect(todoItem).toContain(
          "`todoItem${completed ? ' completed' : ''}`",
        );
        expect(todoItem).toContain("checkbox.id = `todo-${id}`");
        expect(await read(project, `src/todoInput.${ext}`)).toContain(
          "container.id = 'todoInput'",
        );
        expect(await read(project, `src/todoList.${ext}`)).toContain(
          "list.id = 'todoList'",
        );
        expect(await read(project, `src/topBar.${ext}`)).toContain(
          "topBar.id = 'topBar'",
        );
        expect(await read(project, `src/loading.${ext}`)).toContain(
          "loadingDiv.id = 'loading'",
        );
        expect(await read(project, `src/title.${ext}`)).toContain(
          "TinyJoin Todos",
        );
        expect(await read(project, `src/info.${ext}`)).toContain(
          language === "typescript" ? "'/ts.svg'" : "'/js.svg'",
        );

        const styles = await Promise.all(
          STYLE_MODULES.map((module) => read(project, `src/${module}.css`)),
        );
        expect(styles.join("\n")).not.toMatch(/#d81b60|#c2185b/);
        expect(await read(project, "src/button.css")).toContain(
          "background: #7c3aed;",
        );
        expect(await read(project, "src/loading.css")).toContain("%237c3aed");
        expect(await read(project, "src/info.css")).toContain(
          "var(--accent, #7c3aed)",
        );
      });

      it("uses the TinyJoin SQL API for every todo mutation", async () => {
        generate("queries", language, "memory");
        const project = resolve(output, "queries");

        const database = await read(project, `src/database.${ext}`);
        const todoInput = await read(project, `src/todoInput.${ext}`);
        const todoList = await read(project, `src/todoList.${ext}`);

        expect(todoInput).toContain("crypto.randomUUID()");
        expect(todoInput).toContain("INSERT INTO todos");
        expect(todoList).toContain(
          "SELECT id, text, completed, created FROM todos",
        );
        expect(todoList).toContain(
          "UPDATE todos SET completed = $1 WHERE id = $2",
        );
        expect(todoList).toContain("DELETE FROM todos WHERE id = $1");
        expect(todoList).toContain("database.subscribe({tables: ['todos']}");
        expect(database).toContain("database.close()");
        expect(`${database}\n${todoInput}\n${todoList}`).not.toMatch(
          /__tinyjoinDemo|performance\.now|\bjoin\b|group by|transaction\(/i,
        );
      });

      it("generates the same starter with data saved across reloads", async () => {
        generate("saved-app", language, "opfs");

        const project = resolve(output, "saved-app");
        const database = await read(project, `src/database.${ext}`);
        const readme = await read(project, "README.md");

        expect(database).toContain(
          "export const DATA_DIR = 'opfs://tinyjoin-saved-app-db-v2'",
        );
        expect(readme).toContain(
          "saved and restored when\nyou reload the page",
        );
        expect(readme).not.toMatch(/wasm|opfs/i);
        expect(readme).toContain("Tabs share the same saved database");
      });

      it("matches the generated project snapshot", async () => {
        generate("example", language, "memory");
        expect(await snapshotOf(resolve(output, "example"))).toMatchSnapshot();

        generate("saved-app", language, "opfs");
        expect(
          await snapshotOf(resolve(output, "saved-app")),
        ).toMatchSnapshot();
      });
    });
  }

  it("removes every type annotation from the JavaScript starter", async () => {
    generate("javascript-app", "javascript", "memory");
    const project = resolve(output, "javascript-app");

    for (const module of SCRIPT_MODULES) {
      const source = await read(project, `src/${module}.js`);
      expect(source).not.toMatch(
        /\bexport type\b|\binterface\b|:\s*(HTMLElement|string|boolean|Promise<)/,
      );
    }

    // ts-blank-space leaves the sources otherwise untouched, as in
    // create-tinybase.
    expect(await read(project, "src/todoItem.js")).toContain(
      "export const createTodoItem = (id, text, completed, onToggle, onDelete) => {",
    );
    expect(await read(project, "src/index.js")).toContain(
      "const root = document.getElementById('root');",
    );
  });

  it("rejects unsupported language and storage values", () => {
    const language = run(
      [
        "--non-interactive",
        "--projectName",
        "bad-language",
        "--language",
        "coffeescript",
        "--installAndRun",
        "false",
      ],
      {},
      false,
    );
    expect(language.status).not.toBe(0);
    expect(`${language.stdout}${language.stderr}`).toContain(
      "Language must be one of: typescript, javascript.",
    );

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

  it("targets the published TinyJoin release by default", async () => {
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
    expect(manifest.dependencies.tinyjoin).toBe("^0.3.0");
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
    expect(manifest.description).toContain("TinyJoin");
    expect(manifest.homepage).toBe("https://tinyjoin.org");
    expect(manifest.bugs).toEqual({
      url: "https://github.com/tinyplex/create-tinyjoin/issues",
    });
    expect(manifest.engines).toEqual({
      node: "^20.19.0 || >=22.12.0",
    });
    expect(manifest.bin).toEqual({ "create-tinyjoin": "cli.js" });
    expect(manifest.files).toContain("templates");
  });
});

function generate(projectName: string, language: Language, storage: Storage) {
  return run(
    [
      "--non-interactive",
      "--projectName",
      projectName,
      "--language",
      language,
      "--storage",
      storage,
      "--installAndRun",
      "false",
    ],
    { CREATE_TINYJOIN_DEPENDENCY: "9.9.9-test" },
  );
}

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

function read(project: string, file: string): Promise<string> {
  return readFile(resolve(project, file), "utf8");
}

async function snapshotOf(project: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const file of await listFiles(project)) {
    snapshot[file] = await read(project, file);
  }
  return snapshot;
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
