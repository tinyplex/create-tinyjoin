#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCLI,
  detectPackageManager,
  type FileConfig,
  type ProjectConfig,
  type TemplateContext,
} from "tinycreate";

const templateRoot = join(dirname(fileURLToPath(import.meta.url)), "templates");
const args = process.argv.slice(2);

const LANGUAGES = [
  { title: "TypeScript", value: "typescript" },
  { title: "JavaScript", value: "javascript" },
] as const;

const QUERY_OPTIONS = [
  { title: "SQL", value: "sql" },
  { title: "Drizzle ORM", value: "drizzle" },
  { title: "Kysely query builder", value: "kysely" },
] as const;

const STORAGE_OPTIONS = [
  { title: "Save data across reloads (recommended)", value: "opfs" },
  { title: "Start fresh each time", value: "memory" },
] as const;

const optionCatalog = {
  command: "npm create tinyjoin@latest --",
  nonInteractiveFlag: "--non-interactive",
  options: {
    projectName: { type: "string", required: true },
    language: {
      values: LANGUAGES.map(({ value }) => value),
      required: true,
      default: "typescript",
    },
    queries: {
      values: QUERY_OPTIONS.map(({ value }) => value),
      required: true,
      default: "sql",
    },
    storage: {
      values: STORAGE_OPTIONS.map(({ value }) => value),
      required: true,
      default: "opfs",
    },
    installAndRun: {
      values: [true, false],
      required: true,
      recommendedForAgents: false,
    },
  },
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`create-tinyjoin

Interactively scaffold a TinyJoin application:
  npm create tinyjoin@latest

Run non-interactively:
  npm create tinyjoin@latest -- --non-interactive \\
    --projectName my-tinyjoin-app --language typescript --queries sql \\
    --storage opfs --installAndRun false

Agent and automation commands:
  --list-options  Print the current option catalog as JSON
  --help          Show this help`);
  process.exit(0);
}

if (args.includes("--list-options")) {
  console.log(JSON.stringify(optionCatalog, null, 2));
  process.exit(0);
}

const config = {
  welcomeMessage: "🎉 Welcome to TinyJoin!\n",
  questions: [
    {
      type: "text" as const,
      name: "projectName",
      message: "Project name:",
      initial: "my-tinyjoin-app",
      validate: validateProjectName,
    },
    {
      type: "select" as const,
      name: "language",
      message: "Language:",
      choices: [...LANGUAGES],
      initial: 0,
    },
    {
      type: "select" as const,
      name: "queries",
      message: "Queries:",
      choices: [...QUERY_OPTIONS],
      initial: 0,
    },
    {
      type: "select" as const,
      name: "storage",
      message: "Todo data:",
      choices: [...STORAGE_OPTIONS],
      initial: 0,
    },
    {
      type: "confirm" as const,
      name: "installAndRun",
      message: "Install dependencies and start the app?",
      initial: true,
    },
  ],
  createContext: (answers: Record<string, unknown>) => {
    const projectName = String(answers.projectName ?? "").trim();
    const validation = validateProjectName(projectName);
    if (validation !== true) {
      throw new TypeError(validation);
    }
    const language = normalizeChoice(
      answers.language === 0
        ? "typescript"
        : (answers.language ?? "typescript"),
      "language",
      ["typescript", "javascript"],
    );
    const queries = normalizeChoice(
      answers.queries === 0 ? "sql" : (answers.queries ?? "sql"),
      "queries",
      ["sql", "drizzle", "kysely"],
    );
    const storage = normalizeChoice(
      answers.storage === 0 ? "opfs" : (answers.storage ?? "opfs"),
      "storage",
      ["opfs", "memory"],
    );
    const typescript = language === "typescript";

    return {
      projectName,
      installAndRun:
        answers.installAndRun === true || answers.installAndRun === "true",
      language,
      typescript,
      javascript: !typescript,
      scriptExt: typescript ? "ts" : "js",
      ext: typescript ? "ts" : "js",
      queries,
      drizzle: queries === "drizzle",
      kysely: queries === "kysely",
      storage,
      usesOpfs: storage === "opfs",
      storageName: createStorageName(projectName),
      tinyjoinDependency: process.env.CREATE_TINYJOIN_DEPENDENCY ?? "^0.5.0",
    };
  },
  getFiles: (context: TemplateContext): FileConfig[] => {
    const { ext, typescript, queries, drizzle } = context;
    const script = (name: string, template = name): FileConfig => ({
      template: `client/src/${template}.ts.hbs`,
      output: `src/${name}.${ext}`,
      prettier: true,
      transpile: !typescript,
    });
    const style = (name: string): FileConfig => ({
      template: `client/src/${name}.css.hbs`,
      output: `src/${name}.css`,
      prettier: true,
    });

    return [
      { template: "README.md.hbs", output: "README.md", prettier: true },
      { template: "AGENTS.md.hbs", output: "AGENTS.md", prettier: true },
      {
        template: "client/package.json.hbs",
        output: "package.json",
        prettier: true,
      },
      {
        template: "client/.gitignore.hbs",
        output: ".gitignore",
      },
      {
        template: "client/index.html.hbs",
        output: "index.html",
        prettier: true,
      },
      {
        template: "client/vite.config.ts.hbs",
        output: `vite.config.${ext}`,
        prettier: true,
        transpile: !typescript,
      },
      ...(typescript
        ? [
            {
              template: "client/tsconfig.json.hbs",
              output: "tsconfig.json",
              prettier: true,
            },
          ]
        : []),
      {
        template: "client/public/favicon.svg",
        output: "public/favicon.svg",
      },
      typescript
        ? { template: "client/public/ts.svg", output: "public/ts.svg" }
        : { template: "client/public/js.svg", output: "public/js.svg" },
      script("index"),
      script("app"),
      script("topBar"),
      style("topBar"),
      script("title"),
      style("title"),
      script("info"),
      style("info"),
      script("loading"),
      style("loading"),
      script("error"),
      style("error"),
      script("button"),
      style("button"),
      script("input"),
      style("input"),
      script("database"),
      // Each choice of queries has its own todos module, behind the same API.
      script("todos", `todos.${queries}`),
      ...(drizzle ? [script("schema")] : []),
      script("todoInput"),
      style("todoInput"),
      script("todoList"),
      style("todoList"),
      script("todoItem"),
      style("todoItem"),
    ];
  },
  templateRoot,
  installCommand: "{pm} install",
  devCommand: "{pm} run dev",
  workingDirectory: ".",
  onSuccess: (projectName: string) => {
    const packageManager = detectPackageManager();
    console.log("Next steps:");
    console.log(`  cd ${projectName}`);
    console.log(`  ${packageManager} install`);
    console.log(`  ${packageManager} run dev`);
  },
} satisfies ProjectConfig;

createCLI(config).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function validateProjectName(value: string): true | string {
  if (
    !/^[a-z0-9][a-z0-9._-]*$/i.test(value) ||
    value === "." ||
    value === ".."
  ) {
    return "Use letters, numbers, dots, dashes, or underscores without path separators.";
  }
  if (existsSync(join(process.cwd(), value))) {
    return `Directory "${value}" already exists. Choose a different name.`;
  }
  return true;
}

function normalizeChoice<const Value extends string>(
  input: unknown,
  name: string,
  allowed: readonly Value[],
): Value {
  const value = typeof input === "string" ? input : "";
  if (!allowed.includes(value as Value)) {
    throw new TypeError(
      `${capitalize(name)} must be one of: ${allowed.join(", ")}.`,
    );
  }
  return value as Value;
}

function createStorageName(projectName: string): string {
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app";
  const prefix = "tinyjoin-";
  const suffix = "-db-v3";
  return `${prefix}${slug.slice(0, 64 - prefix.length - suffix.length)}${suffix}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
