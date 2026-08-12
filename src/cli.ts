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

const ADAPTERS = [
  { title: "Sample data", value: "sample" },
  { title: "Supabase", value: "supabase" },
] as const;
const STORAGE_OPTIONS = [
  { title: "Memory", value: "memory" },
  { title: "OPFS", value: "opfs" },
] as const;

const optionCatalog = {
  command: "npm create tinygres@latest --",
  nonInteractiveFlag: "--non-interactive",
  options: {
    projectName: { type: "string", required: true },
    adapter: {
      values: ADAPTERS.map(({ value }) => value),
      required: true,
      default: "sample",
    },
    storage: {
      values: STORAGE_OPTIONS.map(({ value }) => value),
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
  },
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`create-tinygres

Interactively scaffold a TinyGres application:
  npm create tinygres@latest

Run non-interactively:
  npm create tinygres@latest -- --non-interactive \\
    --projectName my-tinygres-app --adapter sample --storage memory \\
    --installAndRun false

Generate a Supabase-backed app (URL and publishable key are required):
  npm create tinygres@latest -- --non-interactive \\
    --projectName my-tinygres-app --adapter supabase --storage opfs \\
    --supabaseUrl https://example.supabase.co \\
    --supabasePublishableKey sb_publishable_example --installAndRun false

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
  welcomeMessage: "🎉 Welcome to TinyGres!\n",
  questions: [
    {
      type: "text" as const,
      name: "projectName",
      message: "Project name:",
      initial: "my-tinygres-app",
      validate: validateProjectName,
    },
    {
      type: "select" as const,
      name: "adapter",
      message: "Data adapter:",
      choices: [...ADAPTERS],
      initial: 0,
    },
    {
      type: "select" as const,
      name: "storage",
      message: "Storage:",
      choices: [...STORAGE_OPTIONS],
      initial: 0,
    },
    {
      type: (_previous: unknown, answers: Record<string, unknown>) =>
        answers.adapter === "supabase" ? ("text" as const) : null,
      name: "supabaseUrl",
      message: "Supabase project URL:",
      validate: validateSupabaseUrl,
    },
    {
      type: (_previous: unknown, answers: Record<string, unknown>) =>
        answers.adapter === "supabase" ? ("text" as const) : null,
      name: "supabasePublishableKey",
      message: "Supabase publishable key (or legacy anon key):",
      validate: validateSupabasePublishableKey,
    },
    {
      type: "confirm" as const,
      name: "installAndRun",
      message: "Install dependencies and start the demo?",
      initial: true,
    },
  ],
  createContext: (answers: Record<string, unknown>) => {
    const projectName = String(answers.projectName ?? "").trim();
    const validation = validateProjectName(projectName);
    if (validation !== true) {
      throw new TypeError(validation);
    }
    const adapter = normalizeChoice(
      answers.adapter === 0 ? "sample" : (answers.adapter ?? "sample"),
      "adapter",
      ["sample", "supabase"],
    );
    const storage = normalizeChoice(
      answers.storage === 0 ? "memory" : (answers.storage ?? "memory"),
      "storage",
      ["memory", "opfs"],
    );
    const isSupabase = adapter === "supabase";
    const supabaseConfig = isSupabase
      ? {
          supabaseUrlEnv: JSON.stringify(
            normalizeSupabaseUrl(answers.supabaseUrl),
          ),
          supabasePublishableKeyEnv: JSON.stringify(
            normalizeSupabasePublishableKey(answers.supabasePublishableKey),
          ),
        }
      : {};

    return {
      projectName,
      installAndRun:
        answers.installAndRun === true || answers.installAndRun === "true",
      adapter,
      storage,
      isSupabase,
      usesOpfs: storage === "opfs",
      storageName: createStorageName(projectName),
      ...supabaseConfig,
      tinygresDependency: process.env.CREATE_TINYGRES_DEPENDENCY ?? "^0.0.3",
    };
  },
  getFiles: (context) => [
    { template: "README.md.hbs", output: "README.md", prettier: true },
    { template: "AGENTS.md.hbs", output: "AGENTS.md", prettier: true },
    {
      template: "client/package.json.hbs",
      output: "client/package.json",
      prettier: true,
    },
    {
      template: "client/.gitignore.hbs",
      output: "client/.gitignore",
    },
    {
      template: "client/index.html.hbs",
      output: "client/index.html",
      prettier: true,
    },
    {
      template: "client/tsconfig.json.hbs",
      output: "client/tsconfig.json",
      prettier: true,
    },
    {
      template: context.isSupabase
        ? "client/src/main.supabase.ts.hbs"
        : "client/src/main.ts.hbs",
      output: "client/src/main.ts",
      prettier: true,
    },
    {
      template: "client/src/style.css.hbs",
      output: "client/src/style.css",
      prettier: true,
    },
    {
      template: "client/src/vite-env.d.ts.hbs",
      output: "client/src/vite-env.d.ts",
      prettier: true,
    },
    ...(context.isSupabase
      ? [
          {
            template: "client/.env.local.hbs",
            output: "client/.env.local",
          },
          {
            template: "client/.env.example.hbs",
            output: "client/.env.example",
          },
          { template: "supabase.sql.hbs", output: "supabase.sql" },
        ]
      : []),
  ],
  templateRoot,
  installCommand: "{pm} install",
  devCommand: "{pm} run dev",
  workingDirectory: "client",
  onSuccess: (projectName: string) => {
    const packageManager = detectPackageManager();
    console.log("Next steps:");
    console.log(`  cd ${projectName}/client`);
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

function validateSupabaseUrl(value: string): true | string {
  try {
    normalizeSupabaseUrl(value);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid Supabase URL.";
  }
}

function normalizeSupabaseUrl(input: unknown): string {
  const rawValue = typeof input === "string" ? input : "";
  if (/\r|\n|%0d|%0a/i.test(rawValue)) {
    throw new TypeError("Supabase URL must not contain CR or LF characters.");
  }
  const value = rawValue.trim();
  if (!value) {
    throw new TypeError(
      "A Supabase URL is required when using the Supabase adapter.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Supabase URL must be an absolute HTTPS URL.");
  }

  if (url.username || url.password) {
    throw new TypeError("Supabase URL must not contain credentials.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isLoopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new TypeError(
      "Supabase URL must use HTTPS (HTTP is allowed only for loopback hosts).",
    );
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

function validateSupabasePublishableKey(value: string): true | string {
  try {
    normalizeSupabasePublishableKey(value);
    return true;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Invalid Supabase publishable key.";
  }
}

function normalizeSupabasePublishableKey(input: unknown): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) {
    throw new TypeError(
      "A Supabase publishable key is required when using the Supabase adapter.",
    );
  }
  if (value.startsWith("sb_secret_")) {
    throw new TypeError(
      "Supabase secret keys must never be used in a browser application.",
    );
  }
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) {
    return value;
  }

  const role = getLegacyJwtRole(value);
  if (role === "service_role") {
    throw new TypeError(
      "Supabase service_role keys must never be used in a browser application.",
    );
  }
  if (role !== "anon") {
    throw new TypeError(
      "Use a Supabase sb_publishable_ key or a legacy anon JWT.",
    );
  }
  return value;
}

function getLegacyJwtRole(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as unknown;
    return isRecord(payload) ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createStorageName(projectName: string): string {
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app";
  const prefix = "tinygres-";
  const suffix = "-posts-v1";
  return `${prefix}${slug.slice(0, 64 - prefix.length - suffix.length)}${suffix}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
