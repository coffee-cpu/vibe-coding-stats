# npm Publishing Setup

This repository uses GitHub Actions to automatically publish the `vibe-coding-stats` package to npm when a new version tag is pushed.

## How It Works

1. **Update version** in `packages/core/package.json`
2. **Commit changes** to the repository
3. **Create and push a git tag** matching the version
4. **GitHub Action runs automatically** and publishes to npm

## Setup Instructions

### One-Time Setup: Configure npm Token

1. **Generate an npm Access Token**:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → "Classic Token"
   - Select **"Automation"** type (for CI/CD)
   - Copy the token (you won't see it again!)

2. **Add token to GitHub Secrets**:
   - Go to your GitHub repository
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click **"Add secret"**

### Publishing a New Version

#### Step 1: Bump the Version

**IMPORTANT**: Choose the correct version type based on your changes:

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

#### Step 2: Commit, Tag, and Push

After running `npm version`, you need to manually commit and tag:

```bash
# 1. Commit the version bump (package.json and package-lock.json will be modified)
git add package-lock.json packages/core/package.json
git commit -m "Bump version to X.Y.Z"

# 2. Create a git tag matching the new version
git tag vX.Y.Z

# 3. Push commits and tags to trigger the publish workflow
git push && git push --tags
```

**Example for v1.0.0**:
```bash
npm version major -w packages/core
git add package-lock.json packages/core/package.json
git commit -m "Bump version to 1.0.0"
git tag v1.0.0
git push && git push --tags
```

## Workflow Details

The GitHub Action (`.github/workflows/publish.yml`) will:

1. ✅ Verify the tag version matches `package.json`
2. ✅ Install dependencies
3. ✅ Run all tests
4. ✅ Build the package
5. ✅ Copy README.md (via `prepublishOnly` hook)
6. ✅ Publish to npm with provenance

## Security Features

- **Provenance**: The workflow uses `--provenance` flag for transparency
- **Version verification**: Prevents publishing if tag doesn't match package.json
- **Test gating**: Won't publish if tests fail
- **Token security**: npm token stored securely in GitHub Secrets

## Troubleshooting

### "Version mismatch" error
- Ensure the git tag (e.g., `v0.1.3`) matches the version in `packages/core/package.json` (e.g., `0.1.3`)

### "Authentication failed" error
- Check that `NPM_TOKEN` secret is set correctly in GitHub
- Verify the npm token hasn't expired
- Ensure the token has "Automation" permissions

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

3. **Update CHANGELOG** before releasing (if you maintain one)

4. **Test the package locally** before publishing:
   ```bash
   npm pack -w packages/core
   # This creates a .tgz file you can inspect or test install
   ```

## Monitoring

- View workflow runs: https://github.com/coffee-cpu/vibe-coding-stats/actions
- View published versions: https://www.npmjs.com/package/vibe-coding-stats
