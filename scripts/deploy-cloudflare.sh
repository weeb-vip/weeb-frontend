#!/bin/bash

# Cloudflare Pages Deployment Script
# Usage: ./scripts/deploy-cloudflare.sh [staging|production] [tag]
#
# Required environment variables:
# - CLOUDFLARE_API_TOKEN
# - CLOUDFLARE_ACCOUNT_ID

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔧${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Parse arguments
ENVIRONMENT=${1:-staging}
TAG=${2:-$(git describe --tags --abbrev=0 2>/dev/null || echo "latest")}

# Validate environment
if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_error "Environment must be 'staging' or 'production'"
    echo "Usage: $0 [staging|production] [tag]"
    exit 1
fi

# Check required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    print_error "CLOUDFLARE_API_TOKEN environment variable is required"
    exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    print_error "CLOUDFLARE_ACCOUNT_ID environment variable is required"
    exit 1
fi

print_status "Starting deployment to Cloudflare Pages"
echo "Environment: $ENVIRONMENT"
echo "Tag: $TAG"
echo "Project: weeb-$ENVIRONMENT"
echo ""

# Enable Corepack
print_status "Enabling Corepack..."
corepack enable

# Install dependencies
print_status "Installing dependencies..."
yarn install --frozen-lockfile

# Check if Cloudflare adapter is installed
print_status "Checking Cloudflare adapter..."
if yarn list @astrojs/cloudflare &>/dev/null; then
    print_success "Cloudflare adapter already installed"
else
    print_status "Installing Cloudflare adapter..."
    yarn add @astrojs/cloudflare --dev
fi

# Set environment variables for build
export APP_CONFIG=$ENVIRONMENT
export VITE_APP_VERSION=$TAG

print_status "Building for environment: $APP_CONFIG"

# Use Cloudflare-specific config
print_status "Using Cloudflare configuration..."
cp astro.config.cloudflare.mjs astro.config.mjs

# Build the project
print_status "Building project..."
yarn build

# Verify build output
print_status "Verifying build output..."
echo "=== Build output structure ==="
ls -la dist/

if [ -f "dist/_worker.js" ]; then
    print_success "Found _worker.js"
else
    print_warning "Missing _worker.js - checking for functions directory"
    if [ -d "dist/_worker" ]; then
        echo "Found _worker directory:"
        ls -la dist/_worker/
    fi
fi

# Install wrangler if not present
if ! command -v wrangler &> /dev/null; then
    print_status "Installing Wrangler..."
    yarn add wrangler --dev
fi

# Determine branch for deployment
if [ "$ENVIRONMENT" = "production" ]; then
    BRANCH="main"
else
    BRANCH="staging"
fi

# Deploy to Cloudflare Pages
print_status "Deploying to Cloudflare Pages..."
echo "Project: weeb-$ENVIRONMENT"
echo "Branch: $BRANCH"

yarn wrangler pages deploy ./dist \
    --project-name="weeb-$ENVIRONMENT" \
    --branch="$BRANCH"

if [ $? -eq 0 ]; then
    print_success "Successfully deployed $TAG to $ENVIRONMENT"
    echo ""
    print_success "🌐 Deployment URL: https://weeb-$ENVIRONMENT.pages.dev"

    # Restore original config
    if [ -f "astro.config.mjs.bak" ]; then
        mv astro.config.mjs.bak astro.config.mjs
        print_status "Restored original astro.config.mjs"
    fi
else
    print_error "Deployment failed"

    # Restore original config on failure
    if [ -f "astro.config.mjs.bak" ]; then
        mv astro.config.mjs.bak astro.config.mjs
        print_status "Restored original astro.config.mjs"
    fi

    exit 1
fi