# Starter validation

`validate.yml` runs on every pull request and main-branch push. It uses the
exact Node version in `.node-version`, `npm ci`, and an explicitly installed
Chromium with its system dependencies. Its token has read-only access and it
uses no publication credentials, including for fork pull requests.

`npm run prePublishPackage` remains the registry-backed release gate. It runs
spelling, type checking, CLI snapshots, all four language/storage generated
builds, and Chromium persistence, error, offline and two-tab scenarios. The
workflow also runs a full tooling audit and a package dry run. It preserves
the console log and failure traces for 14 days.

The registry lane intentionally leaves `CREATE_TINYJOIN_DEPENDENCY` unset;
the generated lockfile must identify the published TinyJoin tarball. If a
template targets a version not yet published, this gate fails until TinyJoin
is published. A successful local candidate check does not satisfy this gate.

## Test an unpublished TinyJoin candidate

With the two repositories checked out as siblings:

```sh
npm --prefix ../tinyjoin run build
npm run test:candidate
```

The candidate script packs the built sibling `dist/`, passes that tarball via
`CREATE_TINYJOIN_DEPENDENCY`, and runs all four generated builds and the same
Chromium suite. It removes the temporary tarball afterwards. Rebuild TinyJoin
after source changes before repeating this check.

This lane is separate from registry validation. It requires a local sibling
checkout; CI does not grant a pull-request token access to another private
repository. Before publishing this starter, publish TinyJoin, then run the
registry-backed `npm run prePublishPackage` with the override unset.
