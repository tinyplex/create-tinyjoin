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

Run the local generator from this repository's parent directory with:

```sh
npm --prefix create-tinygres run local
```

This builds only the generator. The generated app installs the published
TinyGres package, including its precompiled WASM, so Rust is not required. Any
create-tinygres CLI options can be appended after `--`.

To test unpublished changes from a neighboring TinyGres source repository, use
the explicitly separate source-integration command:

```sh
npm --prefix create-tinygres run local:source
```

That command builds and packs the sibling TinyGres repository before starting
the generator, so it does require the TinyGres Rust toolchain.
