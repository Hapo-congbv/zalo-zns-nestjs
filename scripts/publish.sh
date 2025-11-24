#!/bin/bash

# Script to publish package to npm
# Usage: ./scripts/publish.sh [--dry-run]

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No changes will be published"
fi

echo "📦 Publishing package..."

# Check if user is logged in to npm
if ! npm whoami &> /dev/null; then
  echo "❌ Error: Not logged in to npm. Please run 'npm login' first."
  exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "Current version: $VERSION"

# Check if version already exists on npm
if npm view "@hapo-congbv/zalo-zns-nestjs@$VERSION" version &> /dev/null; then
  echo "❌ Error: Version $VERSION already exists on npm"
  echo "Please bump version first using: npm run version:patch|minor|major"
  exit 1
fi

# Run tests
echo "🧪 Running tests..."
npm test

# Build package
echo "🔨 Building package..."
npm run build

# Check if dist folder exists
if [ ! -d "dist" ]; then
  echo "❌ Error: dist folder not found. Build failed?"
  exit 1
fi

# Check if CHANGELOG has entry for this version
if ! grep -q "## \[$VERSION\]" CHANGELOG.md; then
  echo "⚠️  Warning: CHANGELOG.md doesn't have an entry for version $VERSION"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Publish
if [ "$DRY_RUN" = true ]; then
  echo "🔍 Dry run - would publish with: npm publish --access public"
  npm publish --access public --dry-run
else
  echo "🚀 Publishing to npm..."
  npm publish --access public
  echo "✅ Published successfully!"
  echo ""
  echo "Package available at: https://www.npmjs.com/package/@hapo-congbv/zalo-zns-nestjs"
fi

