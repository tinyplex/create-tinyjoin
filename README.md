# create-tinygres

Scaffold a small TypeScript and Vite application that runs TinyGres in a
dedicated Web Worker.

```sh
npm create tinygres@latest
```

For agents and CI, every option can be supplied non-interactively:

```sh
npm create tinygres@latest -- --non-interactive \
  --projectName my-tinygres-app \
  --adapter sample --storage memory \
  --installAndRun false
```

Use `--list-options` for the machine-readable option catalog or `--help` for
usage. The wizard asks for two independent choices:

- **Adapter:** a network-free sample dataset, or a read-only Supabase replica.
- **Storage:** memory, or persistent browser OPFS.

The sample adapter loads a small snapshot, runs parameterized SQL locally, and
simulates one normalized incoming server change. The Supabase adapter asks for
a browser-safe project URL and publishable key, writes them only to ignored
`client/.env.local`, and generates `supabase.sql` for its disposable public demo
table. For example:

```sh
npm create tinygres@latest -- --non-interactive \
  --projectName my-tinygres-app \
  --adapter supabase --storage opfs \
  --supabaseUrl https://your-project.supabase.co \
  --supabasePublishableKey sb_publishable_your-key \
  --installAndRun false
```

Run the generated `supabase.sql` in the Supabase SQL editor before starting a
Supabase-backed app. Never provide a secret or service-role key.

This repository is a private development package. `npm run build` assembles the
publishable `create-tinygres` package under `dist/`.

## Development

```sh
npm run typecheck       # generator and test TypeScript
npm test                # CLI, template, and package-boundary tests
npm run test:generated  # sample + Supabase apps against published TinyGres
npm run test:e2e        # real Chromium Worker/WASM + Supabase protocol flows
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
