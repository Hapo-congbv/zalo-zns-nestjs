#!/bin/bash

# Complete release script: bump version, update changelog, and publish
# Usage: ./scripts/release.sh [patch|minor|major] [--dry-run] [--skip-publish]

set -e

VERSION_TYPE=${1:-patch}
DRY_RUN=false
SKIP_PUBLISH=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      ;;
    --skip-publish)
      SKIP_PUBLISH=true
      ;;
  esac
done

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Version type must be patch, minor, or major"
  exit 1
fi

echo "🚀 Starting release process..."
echo "Version type: $VERSION_TYPE"
if [ "$DRY_RUN" = true ]; then
  echo "Mode: DRY RUN"
fi
if [ "$SKIP_PUBLISH" = true ]; then
  echo "Mode: SKIP PUBLISH"
fi
echo ""

# Step 1: Bump version (standard-version will create commit and tag)
echo "📝 Step 1: Bumping version and generating CHANGELOG..."
if [ "$DRY_RUN" = true ]; then
  echo "🔍 Dry run - would run: ./scripts/version-bump.sh $VERSION_TYPE"
  # Get current version for dry run
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo "   Current version: $CURRENT_VERSION"
else
  ./scripts/version-bump.sh "$VERSION_TYPE"
fi

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
NEW_VERSION=${NEW_VERSION#v}

echo ""
echo "📝 CHANGELOG.md has been auto-generated from git commits"
echo "   Please review it before continuing..."
read -p "Press Enter to continue..."

# Step 2: Commit and tag (standard-version already did this, but we check)
if [ "$DRY_RUN" != true ]; then
  echo ""
  echo "📝 Step 2: Git commit and tag (already created by standard-version)"
  echo "   To push: git push --follow-tags"
fi

# Step 3: Publish
if [ "$SKIP_PUBLISH" = false ]; then
  echo ""
  echo "📦 Step 3: Publishing to npm..."
  if [ "$DRY_RUN" = true ]; then
    ./scripts/publish.sh --dry-run
  else
    read -p "Publish to npm now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      ./scripts/publish.sh
    else
      echo "Skipped publishing. Run 'npm run publish:package' when ready."
    fi
  fi
fi

echo ""
echo "✅ Release process completed!"
echo "Version: $NEW_VERSION"

