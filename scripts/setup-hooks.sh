#!/bin/bash

# Setup script for git hooks
# This script installs the pre-push hook for the Amazon Ebook Scraper project

echo "Setting up git hooks..."

# Check if we're in the root of the repository
if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
    echo "❌ Error: This script must be run from the root of the repository"
    exit 1
fi

# Copy pre-push hook to .git/hooks/
echo "Installing pre-push hook..."
cp scripts/pre-push .git/hooks/pre-push

# Make the hook executable
chmod +x .git/hooks/pre-push

echo "✅ Pre-push hook installed successfully!"
echo "The hook will now run automatically before each push to verify:"
echo "  - pnpm lint (code formatting and linting)"
echo "  - pnpm build (compilation check)"
echo "  - pnpm test (test suite)"