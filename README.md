# create-tinyjoin

Scaffold a small local todo app with TinyJoin, TypeScript, and Vite:

```sh
npm create tinyjoin@latest
```

The generated project is ready to run at its root and needs no database server,
account, or credentials. Choose whether its todos should remain after reloads or
start fresh each time.

For agents and CI, every option can be supplied non-interactively:

```sh
npm create tinyjoin@latest -- --non-interactive \
  --projectName my-tinyjoin-app \
  --storage opfs \
  --installAndRun false
```

Use `--list-options` for the machine-readable option catalog or `--help` for
usage.

This repository is a private development package. `npm run build` assembles the
publishable `create-tinyjoin` package under `dist/`.

## Development

```sh
npm run typecheck       # generator and test TypeScript
npm test                # CLI, template, and package-boundary tests
npm run test:generated  # build generated persistent and temporary apps
npm run test:e2e        # real generated-app behavior in Chromium
```

Run the local generator from this repository's parent directory with:

```sh
npm --prefix create-tinyjoin run local
```

This builds only the generator. The generated app installs the published
TinyJoin package, so its native build toolchain is not required.

To test unpublished changes from a neighboring TinyJoin source repository, use:

```sh
npm --prefix create-tinyjoin run local:source
```

That command builds and packs the sibling TinyJoin repository before starting
the generator.
