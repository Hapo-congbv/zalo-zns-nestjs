# Release Scripts Documentation

## Overview

Package này sử dụng **standard-version** (giống như engine module) để tự động:
- Generate CHANGELOG.md từ conventional commits
- Bump version theo semantic versioning
- Tạo git tags

## Scripts

### Version Bump Scripts

#### `npm run version:auto`
Tự động detect version bump từ conventional commits:
- Phân tích commit messages từ tag cuối cùng
- Xác định version bump type (patch/minor/major)
- Generate CHANGELOG.md
- Bump version trong package.json
- Tạo git commit và tag

#### `npm run version:patch|minor|major`
Bump version cụ thể và generate CHANGELOG.

### Publish Scripts

#### `npm run publish:package`
Publish package lên npm với validation:
- Kiểm tra đã đăng nhập npm chưa
- Kiểm tra version đã tồn tại chưa
- Chạy tests
- Build package
- Publish

#### `npm run publish:dry-run`
Test publish process mà không publish thật.

### Release Scripts (All-in-one)

#### `npm run release:auto` ⭐ (Khuyến nghị)
Full release process với auto-detect version:
1. Bump version và generate CHANGELOG
2. Review CHANGELOG
3. Publish (sau khi xác nhận)

#### `npm run release:patch|minor|major`
Full release với version cụ thể.

#### `npm run release:dry-run`
Test toàn bộ release process.

#### `npm run release:skip-publish`
Release nhưng không publish (chỉ version và tag).

## Workflow

### Recommended Workflow

1. **Develop và commit với conventional commits:**
   ```bash
   git commit -m "feat(zns): add new feature"
   git commit -m "fix(zns): fix bug"
   ```

2. **Release:**
   ```bash
   npm run release:auto
   ```

3. **Push:**
   ```bash
   git push --follow-tags
   ```

### Conventional Commits

Sử dụng conventional commits để CHANGELOG được generate tự động:

- `feat:` → Minor version bump
- `fix:` → Patch version bump  
- `BREAKING CHANGE:` → Major version bump

Xem [CONVENTIONAL_COMMITS.md](../CONVENTIONAL_COMMITS.md) để biết chi tiết.

## Comparison với Engine Module

| Feature | Engine Module | Zalo ZNS Package |
|---------|--------------|------------------|
| Monorepo | ✅ Lerna | ❌ Single package |
| Auto CHANGELOG | ✅ Conventional commits | ✅ Conventional commits |
| Auto version bump | ✅ From commits | ✅ From commits |
| Tool | Lerna | standard-version |
| Complexity | High (monorepo) | Low (single package) |

## Files

- `scripts/version-bump.sh` - Version bump script
- `scripts/publish.sh` - Publish script
- `scripts/release.sh` - Full release script
- `.versionrc.json` - standard-version configuration
- `CHANGELOG.md` - Auto-generated changelog

