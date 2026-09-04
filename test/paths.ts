import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const generatedTestRoot = resolve(
  tmpdir(),
  "create-tinyjoin-generated-test",
);

export type Language = "typescript" | "javascript";
export type Storage = "opfs" | "memory";

export type GeneratedApp = {
  name: string;
  language: Language;
  storage: Storage;
  ext: "ts" | "js";
  path: string;
  port: number;
};

const app = (
  name: string,
  language: Language,
  storage: Storage,
  port: number,
): GeneratedApp => ({
  name,
  language,
  storage,
  ext: language === "typescript" ? "ts" : "js",
  path: resolve(generatedTestRoot, name),
  port,
});

/** Every language and storage combination, all of which must install and build. */
export const generatedApps: GeneratedApp[] = [
  app("app", "typescript", "opfs", 4174),
  app("js-app", "javascript", "opfs", 4175),
  app("fresh-app", "typescript", "memory", 4176),
  app("js-fresh-app", "javascript", "memory", 4177),
];

/** The saved apps, which the Playwright suite drives in a real browser. */
export const e2eApps: GeneratedApp[] = generatedApps.filter(
  ({ storage }) => storage === "opfs",
);

export function generatedApp(name: string): GeneratedApp {
  const found = generatedApps.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Unknown generated app: ${name}`);
  }
  return found;
}
