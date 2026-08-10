# create-tinygres

Scaffold a small TypeScript and Vite application that runs TinyGres in a
dedicated Web Worker.

```sh
npm create tinygres@latest
```

For agents and CI, every option can be supplied non-interactively:

```sh
npm create tinygres@latest -- --non-interactive \
  --projectName my-tinygres-app --installAndRun false
```

Use `--list-options` for the machine-readable option catalog or `--help` for
usage. The generated starter is intentionally network-free: it loads a sample
snapshot, runs parameterized SQL locally, and simulates one normalized incoming
server change. Supabase credentials and persistent storage are not configured
by the initial generator.

This repository is a private development package. `npm run build` assembles the
publishable `create-tinygres` package under `dist/`.

## Development

```sh
npm run typecheck       # generator and test TypeScript
npm test                # CLI, template, and package-boundary tests
npm run test:generated  # generated app against the published TinyGres package
npm run test:e2e        # generated app build plus real Chromium Worker/WASM flow
```

When this repository and `tinygres` are neighboring directories, run the
generator against the current TinyGres source from their shared parent:

```sh
npm --prefix create-tinygres run local
```

The local command builds both projects and packs TinyGres before starting the
generator. Generated apps therefore install the same package shape that will be
published, rather than linking directly to TinyGres's transient `dist/`
directory. Any create-tinygres CLI options can be appended after `--`.
