# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Amazon ebook scraper project that appears to be in the initial setup phase. Based on the repository name and structure, this will likely be a Node.js application for scraping ebook data from Amazon.

## Current State

The repository is configured as a pnpm monorepo with:
- Root package.json with workspace configuration
- pnpm-workspace.yaml defining workspace structure
- TypeScript configuration for monorepo development
- Biome code formatter and linter configured (biome.json)
- Initial packages structure (packages/, apps/, libs/, tools/)
- Sample scraper package in packages/scraper

## Development Setup

This project uses pnpm as the package manager in a monorepo configuration. Common commands:

### Project Setup
- `pnpm install` - Install all dependencies for all workspaces
- `pnpm install:all` - Alias for pnpm install

### Development Commands
- `pnpm dev` - Start development servers for all packages
- `pnpm build` - Build all packages
- `pnpm test` - Run tests for all packages
- `pnpm lint` - Lint all packages
- `pnpm clean` - Clean build artifacts from all packages

### Testing and TDD (Test-Driven Development)
This project follows Test-Driven Development (TDD) practices using [Vitest](https://vitest.dev/):

**TDD Workflow:**
1. **Red** - Write a failing test first
2. **Green** - Write minimal code to make the test pass
3. **Refactor** - Improve code while keeping tests passing

**Testing Commands:**
- `pnpm test` - Run all tests once
- `pnpm test:watch` - Run tests in watch mode (for development)
- `pnpm test:coverage` - Run tests with coverage reporting
- `pnpm -F <workspace> test` - Run tests for specific workspace

**Testing Guidelines:**
- Write tests before implementing functionality (TDD)
- Aim for high test coverage (>80%)
- Test both happy paths and error scenarios
- Use descriptive test names that explain the behavior
- Mock external dependencies (HTTP requests, file system, etc.)
- Group related tests using `describe` blocks

**Test File Structure:**
- Place test files next to source files with `.test.ts` extension
- Use `vitest.config.ts` for test configuration
- Follow the pattern: `src/module.ts` → `src/module.test.ts`

### Code Formatting and Linting
This project uses [Biome](https://biomejs.dev/) for code formatting and linting:

- `pnpm format` - Format all files using Biome
- `pnpm format:check` - Check if files are formatted correctly (no changes)
- `pnpm lint:biome` - Lint files using Biome
- `pnpm check` - Run both formatting and linting checks
- `pnpm check:fix` - Run checks and apply automatic fixes

#### Biome Configuration
- Configuration is stored in `biome.json` at the project root
- Uses default Biome settings with 2-space indentation
- Configured to ignore node_modules, dist, and build directories
- Integrates with Git for tracking changes

#### ESLint Prohibition
**IMPORTANT**: ESLint is prohibited in this project. All packages must use Biome for linting and formatting. Do not add ESLint dependencies or configuration to any package.json files. Use `biome check` commands instead of `eslint` commands in package scripts.

### Pre-commit Verification
**CRITICAL**: Before committing any changes, you MUST ensure that all of the following commands pass without errors:

1. **Lint Check**: `pnpm lint` - All linting rules must pass
2. **Build Check**: `pnpm build` - All packages must compile successfully  
3. **Test Check**: `pnpm test` - All tests must pass

**Verification Workflow:**
```bash
# Run all verification steps
pnpm lint    # Fix any linting issues
pnpm build   # Ensure code compiles
pnpm test    # Verify all tests pass
```

**IMPORTANT**: Never commit changes that fail any of these checks. This ensures code quality and prevents broken builds in the repository. If any step fails, fix the issues before committing.

### Coding Style and Paradigms

#### Functional Programming Preference
**IMPORTANT**: This project follows functional programming principles wherever possible. All new code should be written in functional style:

**Functional Programming Guidelines:**
- **Pure Functions**: Functions should be predictable with no side effects
- **Immutable Data**: Avoid `let` variables and mutations; prefer `const` and creating new objects
- **Higher-Order Functions**: Use functions that accept or return other functions
- **Function Composition**: Break complex logic into small, composable functions
- **Avoid Imperative Loops**: Use `map()`, `filter()`, `find()`, `reduce()` instead of `for` loops
- **Eliminate Mutable State**: Use functional patterns instead of stateful variables

**Functional Patterns to Use:**
```typescript
// Good: Functional selector matching
const findValue = (selectors: readonly string[]) =>
  selectors
    .map(selector => $(selector).text().trim())
    .find(text => text.length > 0) || null;

// Avoid: Imperative loops with mutations
let value = "";
for (const selector of selectors) {
  value = $(selector).text().trim();
  if (value) break;
}
```

**Refactoring Existing Code:**
- When modifying existing procedural code, refactor it to functional style
- Replace mutable variables with pure functions
- Use function composition instead of sequential mutations
- Apply the principles incrementally while maintaining test compatibility

### Workspace-specific Commands
- `pnpm -F <package-name> <command>` - Run command in specific package
- `pnpm -F @amazon-ebook-scraper/scraper dev` - Run dev server for scraper package

### Adding Dependencies
- `pnpm add <package>` - Add dependency to root
- `pnpm -F <workspace> add <package>` - Add dependency to specific workspace

### Package Manager Requirements
- Node.js 22.16.0 (managed by volta)
- pnpm 9.0.0 (managed by volta)

### Node.js Version Management
This project uses [volta](https://volta.sh/) for Node.js and pnpm version management. The versions are specified in the `volta` field in package.json:
- Install volta: `curl https://get.volta.sh | bash`
- After installing volta, the correct Node.js and pnpm versions will be automatically used when you cd into this directory
- Manual installation: `volta install node@22.16.0 pnpm@9.0.0`

## Monorepo Structure

The project follows a monorepo structure with the following directories:

- `packages/` - Core application packages and libraries
- `apps/` - Standalone applications (web apps, CLIs, etc.)
- `libs/` - Shared libraries and utilities
- `tools/` - Development tools and scripts

### Current Packages

- `@amazon-ebook-scraper/scraper` - Core scraping functionality (packages/scraper)

## Notes

The project has been set up with pnpm monorepo configuration. Future development should:
- Add new packages to appropriate directories (packages/, apps/, libs/, tools/)
- Use workspace references for inter-package dependencies
- Follow the established TypeScript configuration
- Maintain consistent naming convention with @amazon-ebook-scraper/ scope
- Run `pnpm format` before committing to ensure consistent code formatting
- Use `pnpm check` to verify code formatting and linting before commits