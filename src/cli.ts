#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCLI,
  detectPackageManager,
  type ProjectConfig,
} from "tinycreate";

const templateRoot = join(dirname(fileURLToPath(import.meta.url)), "templates");
const args = process.argv.slice(2);

const STORAGE_OPTIONS = [
  { title: "Save data across reloads (recommended)", value: "opfs" },
  { title: "Start fresh each time", value: "memory" },
] as const;

const optionCatalog = {
  command: "npm create tinyjoin@latest --",
  nonInteractiveFlag: "--non-interactive",
  options: {
    projectName: { type: "string", required: true },
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
    --projectName my-tinyjoin-app --storage opfs \\
    --installAndRun false

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
    const storage = normalizeChoice(
      answers.storage === 0 ? "opfs" : (answers.storage ?? "opfs"),
      "storage",
      ["opfs", "memory"],
    );

    return {
      projectName,
      installAndRun:
        answers.installAndRun === true || answers.installAndRun === "true",
      storage,
      usesOpfs: storage === "opfs",
      storageName: createStorageName(projectName),
      tinyjoinDependency: process.env.CREATE_TINYJOIN_DEPENDENCY ?? "^0.0.5",
    };
  },
  getFiles: () => [
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
      template: "client/tsconfig.json.hbs",
      output: "tsconfig.json",
      prettier: true,
    },
    {
      template: "client/src/database.ts.hbs",
      output: "src/database.ts",
      prettier: true,
    },
    {
      template: "client/src/main.ts.hbs",
      output: "src/main.ts",
      prettier: true,
    },
    {
      template: "client/src/style.css.hbs",
      output: "src/style.css",
      prettier: true,
    },
  ],
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
  const suffix = "-db-v1";
  return `${prefix}${slug.slice(0, 64 - prefix.length - suffix.length)}${suffix}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
