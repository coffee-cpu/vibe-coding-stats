# npm Publishing Setup

This repository uses GitHub Actions with **npm Trusted Publishing** to automatically publish the `vibe-coding-stats` package to npm when a new version tag is pushed.

## How It Works

1. **Update version** in `packages/core/package.json`
2. **Commit changes** to the repository
3. **Create and push a git tag** matching the version
4. **GitHub Action runs automatically** and publishes to npm via OIDC (no tokens needed)

## Setup (Already Configured)

This repo uses **Trusted Publishing** via OpenID Connect (OIDC), which is more secure than token-based auth. The configuration is:

- **npm side**: Trusted Publisher configured at https://www.npmjs.com/package/vibe-coding-stats/access
- **GitHub side**: Workflow has `id-token: write` permission

No `NPM_TOKEN` secret is required.

## Publishing a New Version

### Step 1: Bump the Version

Choose the correct version type based on your changes:

```bash
# For PATCH release (1.0.0 → 1.0.1)
# Use when you make backward compatible bug fixes
npm version patch -w packages/core

# For MINOR release (1.0.1 → 1.1.0)
# Use when you add functionality in a backward compatible manner
npm version minor -w packages/core

# For MAJOR release (1.1.0 → 2.0.0)
# Use when you make incompatible API changes
npm version major -w packages/core
```

**Note**: In our monorepo setup, `npm version` only updates `package.json` and `package-lock.json` but doesn't automatically create commits or tags.

### Step 2: Commit, Tag, and Push

```bash
# 1. Commit the version bump
git add package-lock.json packages/core/package.json
git commit -m "Bump version to X.Y.Z"

# 2. Create a git tag matching the new version
git tag vX.Y.Z

# 3. Push commits and tags to trigger the publish workflow
git push && git push --tags
```

**Example for v1.5.0**:
```bash
npm version minor -w packages/core
git add package-lock.json packages/core/package.json
git commit -m "Bump version to 1.5.0"
git tag v1.5.0
git push && git push --tags
```

## Workflow Details

The GitHub Action (`.github/workflows/publish.yml`) will:

1. Verify the tag version matches `package.json`
2. Install dependencies
3. Run all tests
4. Build the package
5. Publish to npm with provenance attestation

## Security Features

- **Trusted Publishing**: Uses OIDC instead of long-lived tokens
- **Provenance**: Cryptographically signed attestation linking package to source
- **Version verification**: Prevents publishing if tag doesn't match package.json
- **Test gating**: Won't publish if tests fail

## Troubleshooting

### "Version mismatch" error
- Ensure the git tag (e.g., `v1.4.0`) matches the version in `packages/core/package.json` (e.g., `1.4.0`)

### "ENEEDAUTH" or "need auth" error
- Verify Trusted Publisher is configured correctly at npm package settings
- Check that repo owner/name and workflow filename match exactly

### "Package already published" error
- You cannot republish the same version
- Bump the version number and create a new tag

## Best Practices

1. **Always run tests locally** before creating a tag:
   ```bash
   npm test -w packages/core
   ```

2. **Use semantic versioning**:
   - **Patch** (0.1.x): Bug fixes, no breaking changes
   - **Minor** (0.x.0): New features, no breaking changes
   - **Major** (x.0.0): Breaking changes

3. **Test the package locally** before publishing:
   ```bash
   npm pack -w packages/core
   # This creates a .tgz file you can inspect or test install
   ```

## Monitoring

- View workflow runs: https://github.com/coffee-cpu/vibe-coding-stats/actions
- View published versions: https://www.npmjs.com/package/vibe-coding-stats
