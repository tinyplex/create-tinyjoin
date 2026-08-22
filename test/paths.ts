import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const generatedTestRoot = resolve(
  tmpdir(),
  "create-tinygres-generated-test",
);

export const generatedSavedApp = resolve(generatedTestRoot, "app");

export const generatedFreshApp = resolve(generatedTestRoot, "fresh-app");
