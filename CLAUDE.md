# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Amazon ebook scraper project that appears to be in the initial setup phase. Based on the repository name and structure, this will likely be a Node.js application for scraping ebook data from Amazon.

## Current State

The repository is configured as a pnpm monorepo with:
- Root package.json with workspace configuration
- pnpm-workspace.yaml defining workspace structure
- TypeScript configuration for monorepo development
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

### Workspace-specific Commands
- `pnpm -F <package-name> <command>` - Run command in specific package
- `pnpm -F @amazon-ebook-scraper/scraper dev` - Run dev server for scraper package

### Adding Dependencies
- `pnpm add <package>` - Add dependency to root
- `pnpm -F <workspace> add <package>` - Add dependency to specific workspace

### Package Manager Requirements
- Node.js 18.20.4 (managed by volta)
- pnpm 9.0.0 (managed by volta)

### Node.js Version Management
This project uses [volta](https://volta.sh/) for Node.js and pnpm version management. The versions are specified in the `volta` field in package.json:
- Install volta: `curl https://get.volta.sh | bash`
- After installing volta, the correct Node.js and pnpm versions will be automatically used when you cd into this directory
- Manual installation: `volta install node@18.20.4 pnpm@9.0.0`

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