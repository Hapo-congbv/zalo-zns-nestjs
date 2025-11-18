#!/bin/bash

# Script to bump version and update CHANGELOG using standard-version
# Usage: ./scripts/version-bump.sh [patch|minor|major|--first-release]

set -e

VERSION_TYPE=${1:-patch}
FIRST_RELEASE=false

if [[ "$1" == "--first-release" ]]; then
  FIRST_RELEASE=true
  VERSION_TYPE=""
fi

if [[ ! -z "$VERSION_TYPE" && ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Version type must be patch, minor, or major"
  exit 1
fi

echo "🚀 Bumping version using standard-version..."

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Run tests and build before version bump
echo "📦 Running tests..."
npm test

echo "🔨 Building package..."
npm run build

# Use standard-version to bump version and generate CHANGELOG
echo "📝 Bumping version and generating CHANGELOG..."

if [ "$FIRST_RELEASE" = true ]; then
  npx standard-version --first-release
else
  if [ -z "$VERSION_TYPE" ]; then
    # Auto-detect version bump from conventional commits
    npx standard-version
  else
    npx standard-version --release-as $VERSION_TYPE
  fi
fi

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
NEW_VERSION=${NEW_VERSION#v}

echo "✅ Version bumped to $NEW_VERSION"
echo "📝 CHANGELOG.md updated automatically from git commits"
echo ""
echo "Next steps:"
echo "1. Review CHANGELOG.md (auto-generated from commits)"
echo "2. Commit changes: git add . && git commit -m \"chore(release): $NEW_VERSION\""
echo "3. Push: git push --follow-tags"
echo "4. Publish: npm run publish:package"

