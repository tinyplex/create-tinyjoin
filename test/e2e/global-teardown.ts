import { rm } from "node:fs/promises";
import { generatedTestRoot } from "../paths.js";

export default async function globalTeardown(): Promise<void> {
  await rm(generatedTestRoot, {
    force: true,
    maxRetries: 10,
    recursive: true,
    retryDelay: 100,
  });
}
