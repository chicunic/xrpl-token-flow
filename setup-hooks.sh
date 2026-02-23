#!/bin/bash

# Setup script for Git hooks
# This script is automatically run during 'pnpm install' via postinstall hook

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running in CI environment
if [ "$CI" = "true" ] || [ "$GITHUB_ACTIONS" = "true" ]; then
    echo "⏭️ Skipping Git hooks setup in CI environment"
    exit 0
fi

echo -e "${BLUE}🔧 Setting up Git hooks for XRPL Stablecoin Flow...${NC}"

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠️ Not in a Git repository, skipping hooks setup${NC}"
    exit 0
fi

# Configure Git to use our hooks directory
echo -e "${YELLOW}📁 Configuring Git to use .githooks directory...${NC}"
git config core.hooksPath .githooks

# Make hooks executable
echo -e "${YELLOW}🔐 Making hooks executable...${NC}"
chmod +x .githooks/pre-commit
chmod +x .githooks/pre-push

# Verify configuration
HOOKS_PATH=$(git config core.hooksPath)
if [ "$HOOKS_PATH" = ".githooks" ]; then
    echo -e "${GREEN}✅ Git hooks configured successfully!${NC}"
else
    echo -e "${RED}❌ Failed to configure Git hooks${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Git hooks setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Installed hooks:${NC}"
echo -e "  • ${YELLOW}pre-commit${NC}: Biome check, TypeScript type check"
echo -e "  • ${YELLOW}pre-push${NC}: Branch-specific checks (basic for main, comprehensive for staging/production)"
echo ""
echo -e "${YELLOW}ℹ️  Git hooks are now automatically configured for all developers!${NC}"
