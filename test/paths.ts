import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const generatedTestRoot = resolve(
  tmpdir(),
  "create-tinyjoin-generated-test",
);

export type Language = "typescript" | "javascript";
export type Queries = "sql" | "drizzle" | "kysely";
export type Storage = "opfs" | "memory";

export type GeneratedApp = {
  name: string;
  /** The app's language, and its queries unless they are SQL, for test titles. */
  label: string;
  language: Language;
  queries: Queries;
  storage: Storage;
  ext: "ts" | "js";
  path: string;
  port: number;
};

const app = (
  name: string,
  language: Language,
  queries: Queries,
  storage: Storage,
  port: number,
): GeneratedApp => ({
  name,
  label: queries === "sql" ? language : `${language} ${queries}`,
  language,
  queries,
  storage,
  ext: language === "typescript" ? "ts" : "js",
  path: resolve(generatedTestRoot, name),
  port,
});

/**
 * Every language and storage combination with SQL, and every language with
 * each query builder and saved data, all of which must install and build. The
 * query builders change only the todos module, not how data is stored.
 */
export const generatedApps: GeneratedApp[] = [
  app("app", "typescript", "sql", "opfs", 4174),
  app("js-app", "javascript", "sql", "opfs", 4175),
  app("fresh-app", "typescript", "sql", "memory", 4176),
  app("js-fresh-app", "javascript", "sql", "memory", 4177),
  app("drizzle-app", "typescript", "drizzle", "opfs", 4178),
  app("js-drizzle-app", "javascript", "drizzle", "opfs", 4179),
  app("kysely-app", "typescript", "kysely", "opfs", 4180),
  app("js-kysely-app", "javascript", "kysely", "opfs", 4181),
];

/** The saved apps, which the Playwright suite drives in a real browser. */
export const e2eApps: GeneratedApp[] = generatedApps.filter(
  ({ storage }) => storage === "opfs",
);

/** Production previews exercise offline loading in every generated variant. */
export const offlineApps = generatedApps.map((app) => ({
  ...app,
  port: app.port + 100,
}));

export function generatedApp(name: string): GeneratedApp {
  const found = generatedApps.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Unknown generated app: ${name}`);
  }
  return found;
}
