# Semantic Versioning Automation

This project uses automated semantic versioning based on git branches with pnpm package management.

## 🎯 Branch Versioning Strategy

| Branch | Version Bump | Example | Use Case |
|--------|-------------|---------|----------|
| `dev` | **patch** (0.0.+1) | 1.2.3 → 1.2.4 | Bug fixes, small features |
| `staging` | **minor** (0.+1.0) | 1.2.3 → 1.3.0 | New features, API changes |
| `main`/`prod` | **major** (+1.0.0) | 1.2.3 → 2.0.0 | Breaking changes, releases |

## 🤖 Automated Workflows

### Automatic Version Bumps
Versions are automatically bumped when code is pushed to target branches:

```yaml
# Triggers on push to dev, staging, main, prod
- Push to dev → patch bump (0.0.+1)
- Push to staging → minor bump (0.+1.0)  
- Push to main/prod → major bump (+1.0.0)
```

**Files Updated:**
- `package.json` - Main version field
- `src/config/version.ts` - Application version constant
- `src/config/environments.ts` - Environment version (if exists)

**Git Actions:**
- Creates commit with conventional format
- Creates git tag (`v1.2.3`)
- Creates GitHub release
- Pushes changes back to branch

### Manual Version Bumps
You can also manually trigger version bumps via GitHub Actions:

1. Go to **Actions** → **Manual Version Bump**
2. Choose **branch** and **bump type**
3. Run workflow

## 💻 Local Development

### pnpm Scripts
```bash
# Check current version
pnpm run version:current

# Manual version bumps (no git operations)
pnpm run version:patch
pnpm run version:minor  
pnpm run version:major

# Local version bump script (includes git operations)
pnpm run version:bump patch|minor|major
pnpm run version:auto  # Auto-detects bump type from branch
```

### Local Script Usage
```bash
# Manual bump types
node scripts/version-bump.js patch
node scripts/version-bump.js minor
node scripts/version-bump.js major

# Auto-detect bump type from current branch
node scripts/version-bump.js --auto

# Override branch detection (for testing)
node scripts/version-bump.js --branch=staging
```

## 📁 Files Involved

### Workflow Files
- `.github/workflows/semantic-versioning.yml` - Automatic version bumps
- `.github/workflows/manual-version-bump.yml` - Manual workflow trigger

### Version Files  
- `package.json` - Main version field
- `src/config/version.ts` - Application version constant
- `scripts/version-bump.js` - Local version bump script

### Generated Files
- Git tags (`v1.2.3`)
- GitHub releases
- Commit messages with conventional format

## 🔄 Workflow Details

### Automatic Workflow (`semantic-versioning.yml`)
```yaml
Triggers:
  - push: dev, staging, main, prod
  - pull_request: merged to target branches

Steps:
  1. Checkout code
  2. Setup pnpm + Node.js
  3. Install dependencies
  4. Determine bump type from branch
  5. Bump version with pnpm
  6. Update version files
  7. Create commit and tag
  8. Push changes
  9. Create GitHub release
```

### Manual Workflow (`manual-version-bump.yml`)
```yaml
Triggers:
  - workflow_dispatch (manual trigger)

Inputs:
  - bump_type: patch|minor|major
  - branch: dev|staging|main|prod

Same steps as automatic workflow
```

## 📋 Commit Message Format

Automated commits use conventional format:
```
chore(dev): bump version to 1.2.4 [patch]

- Automated version bump from 1.2.3 to 1.2.4
- Triggered by push to dev branch
- Bump type: patch
```

## 🏷️ Git Tags & Releases

### Git Tags
- Format: `v1.2.3`
- Created automatically
- Pushed to remote

### GitHub Releases
- Created for every version bump
- Contains version info and changelog
- Pre-release flag for non-main branches

## ⚙️ Configuration

### Branch Rules
The version bump logic is defined in the workflow:
```yaml
case $BRANCH_NAME in
  "dev")
    echo "bump_type=patch"
    ;;
  "staging") 
    echo "bump_type=minor"
    ;;
  "main"|"prod")
    echo "bump_type=major"
    ;;
esac
```

### Version File Updates
The workflow automatically updates:
```bash
# src/config/version.ts
sed -i "s/export const VERSION = .*/export const VERSION = '$NEW_VERSION'/"

# src/config/environments.ts  
sed -i "s/version: .*/version: '$NEW_VERSION',/"
```

## 🚨 Troubleshooting

### Common Issues

**Workflow not triggering:**
- Check branch names match exactly
- Ensure GitHub Actions are enabled
- Check repository permissions

**Version not updating in files:**
- Verify file paths exist
- Check sed syntax in workflow
- Review workflow logs

**Git push failures:**
- Check repository permissions
- Verify GITHUB_TOKEN has write access
- Review branch protection rules

### Manual Recovery
If automated versioning fails:
```bash
# Reset version manually
pnpm version 1.2.3 --no-git-tag-version

# Update version files
node scripts/version-bump.js --auto

# Create tag manually
git tag -a v1.2.3 -m "Version 1.2.3"
git push origin v1.2.3
```

## 🎉 Benefits

- **Consistent**: Same versioning strategy across all environments
- **Automated**: No manual version management needed
- **Traceable**: Clear git history with conventional commits
- **Integrated**: Works with pnpm, GitHub Actions, and releases
- **Flexible**: Manual override when needed
- **Fast**: pnpm-based version bumping
