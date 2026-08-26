# Repository Rules

## Release version rule

- Every GitHub Release must use a new stable semantic version that is strictly greater than every existing release version.
- Before creating a release, update the version in `package.json`, `package-lock.json`, `app/package.json`, and `app/package-lock.json`. All four versions must match.
- The release tag must be exactly `v<version>` (for example, package version `1.2.3` requires tag `v1.2.3`). Never reuse or move an existing release tag.
- Run `npm run release:check` before building or tagging a release. Do not publish when this check fails.
- Releases are built, signed, and uploaded manually. GitHub Actions must not be required for publishing.
- Follow `docs/RELEASING.md` for required asset names. The updater will not discover incorrectly named assets.
