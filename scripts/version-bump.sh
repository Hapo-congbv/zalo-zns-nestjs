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

# Predict new version to check if tag exists (only for explicit version types)
if [ ! -z "$VERSION_TYPE" ] && [ "$FIRST_RELEASE" != true ]; then
  # Calculate predicted version
  IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
  MAJOR=${VERSION_PARTS[0]}
  MINOR=${VERSION_PARTS[1]}
  PATCH=${VERSION_PARTS[2]}
  
  case $VERSION_TYPE in
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    patch)
      PATCH=$((PATCH + 1))
      ;;
  esac
  PREDICTED_VERSION="$MAJOR.$MINOR.$PATCH"
  TAG_NAME="v$PREDICTED_VERSION"
  
  # Check and remove existing tag if it exists
  if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo "⚠️  Tag $TAG_NAME already exists. Removing it..."
    git tag -d "$TAG_NAME" 2>/dev/null || true
    # Try to delete remote tag if it exists
    if git ls-remote --tags origin "$TAG_NAME" >/dev/null 2>&1; then
      echo "⚠️  Removing remote tag $TAG_NAME..."
      git push origin ":refs/tags/$TAG_NAME" 2>/dev/null || true
    fi
  fi
fi

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
    npx standard-version || {
      # If tag creation fails, get the version that standard-version tried to create
      # and remove the tag if it exists
      NEW_VERSION=$(node -p "require('./package.json').version")
      TAG_NAME="v$NEW_VERSION"
      if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
        echo "⚠️  Tag $TAG_NAME exists. Removing and retrying..."
        git tag -d "$TAG_NAME" 2>/dev/null || true
        git push origin ":refs/tags/$TAG_NAME" 2>/dev/null || true
        # Revert package.json version change
        git checkout package.json 2>/dev/null || true
        # Retry without tag creation, then create tag manually
        npx standard-version --skip-tag --skip-commit
        git tag -a "$TAG_NAME" -m "chore(release): $NEW_VERSION"
      else
        exit 1
      fi
    }
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

