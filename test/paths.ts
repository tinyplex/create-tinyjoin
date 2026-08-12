import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const generatedTestRoot = resolve(
  tmpdir(),
  "create-tinygres-generated-test",
);

export const generatedSampleClient = resolve(generatedTestRoot, "app/client");

export const generatedSupabaseClient = resolve(
  generatedTestRoot,
  "supabase-app/client",
);
