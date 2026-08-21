# create-tinygres

Scaffold a small TypeScript and Vite application around the standalone
TinyGres browser database:

```sh
npm create tinygres@latest
```

The generated app uses TinyGres's default dedicated module Worker and
precompiled Rust/WASM engine. It creates a typed relational schema with one
atomic SQL script, writes data with parameterized statements and a callback
transaction, and renders a parameterized multi-table query plus an aggregate.
Table subscriptions keep the UI current after each commit.

The only product choice is storage:

- **OPFS** is recommended and selected by default. It persists the page-native
  database across reloads.
- **Memory** starts from a blank database on every page load, so the demo
  bootstraps its schema and sample rows again.

For agents and CI, every option can be supplied non-interactively:

```sh
npm create tinygres@latest -- --non-interactive \
  --projectName my-tinygres-app \
  --storage opfs \
  --installAndRun false
```

Use `--list-options` for the machine-readable option catalog or `--help` for
usage. The generated project runs entirely locally, with no network credentials
or remote service dependency.

This repository is a private development package. `npm run build` assembles the
publishable `create-tinygres` package under `dist/`.

## Development

```sh
npm run typecheck       # generator and test TypeScript
npm test                # CLI, template, and package-boundary tests
npm run test:generated  # generated memory and OPFS apps
npm run test:e2e        # real Chromium Worker/WASM behavior
```

Run the local generator from this repository's parent directory with:

```sh
npm --prefix create-tinygres run local
```

This builds only the generator. The generated app installs the published
TinyGres package, including its precompiled WASM, so Rust is not required. Any
create-tinygres CLI options can be appended after `--`.

To test unpublished changes from a neighboring TinyGres source repository, use
the explicitly separate sibling-source command:

```sh
npm --prefix create-tinygres run local:source
```

That command builds and packs the sibling TinyGres repository before starting
the generator, so it does require the TinyGres Rust toolchain.
