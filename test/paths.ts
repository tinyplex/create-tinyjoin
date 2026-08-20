import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const generatedTestRoot = resolve(
  tmpdir(),
  "create-tinygres-generated-test",
);

export const generatedOpfsClient = resolve(generatedTestRoot, "app/client");

export const generatedMemoryClient = resolve(
  generatedTestRoot,
  "memory-app/client",
);
