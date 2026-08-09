# create-tinygres

Scaffold a small TypeScript and Vite application that runs Tinygres in a
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
npm run test:generated  # generated app install and production Vite build
npm run test:e2e        # generated app build plus real Chromium Worker/WASM flow
```
