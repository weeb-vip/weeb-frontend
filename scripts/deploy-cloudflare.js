#!/usr/bin/env node

/**
 * Cloudflare Pages Deployment Script
 * Usage: node scripts/deploy-cloudflare.js [staging|production] [tag]
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve } from 'path';

// Colors for output
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function print(type, message) {
  const icons = {
    status: '🔧',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  const color = colors[type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue'];
  console.log(`${color}${icons[type] || icons.status}${colors.reset} ${message}`);
}

function run(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
  } catch (error) {
    if (!options.allowFailure) {
      print('error', `Command failed: ${command}`);
      process.exit(1);
    }
    return null;
  }
}

function main() {
  // Check if we're in the right directory
  if (!existsSync('package.json')) {
    print('error', 'Please run this script from the project root directory');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const environment = args[0] || 'staging';
  const tag = args[1] || run('git describe --tags --abbrev=0', { silent: true, allowFailure: true })?.trim() || 'latest';

  // Validate environment
  if (!['staging', 'production'].includes(environment)) {
    print('error', 'Environment must be "staging" or "production"');
    console.log('Usage: node scripts/deploy-cloudflare.js [staging|production] [tag]');
    process.exit(1);
  }

  // Check required environment variables
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    print('error', 'CLOUDFLARE_API_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    print('error', 'CLOUDFLARE_ACCOUNT_ID environment variable is required');
    process.exit(1);
  }

  print('status', 'Starting deployment to Cloudflare Pages');
  console.log(`Environment: ${environment}`);
  console.log(`Tag: ${tag}`);
  console.log(`Project: weeb-${environment}`);
  console.log('');

  try {
    // Enable Corepack
    print('status', 'Enabling Corepack...');
    run('corepack enable');

    // Install dependencies
    print('status', 'Installing dependencies...');
    run('yarn install --frozen-lockfile');

    // Ensure Cloudflare adapter is available
    print('status', 'Checking Cloudflare adapter...');
    try {
      const result = run('yarn list @astrojs/cloudflare --depth=0', { silent: true, allowFailure: true });
      if (result && result.includes('@astrojs/cloudflare')) {
        print('success', 'Cloudflare adapter already installed');
      } else {
        print('status', 'Installing Cloudflare adapter...');
        run('yarn add @astrojs/cloudflare');
      }
    } catch (error) {
      print('warning', 'Could not check adapter, attempting to install...');
      try {
        run('yarn add @astrojs/cloudflare');
      } catch (installError) {
        print('warning', 'Adapter may already be installed, continuing...');
      }
    }

    // Set environment variables for build
    process.env.APP_CONFIG = environment;
    process.env.VITE_APP_VERSION = tag;

    print('status', `Building for environment: ${environment}`);

    // Backup original config if it exists
    if (existsSync('astro.config.mjs')) {
      copyFileSync('astro.config.mjs', 'astro.config.mjs.bak');
    }

    // Use Cloudflare-specific config
    print('status', 'Using Cloudflare configuration...');
    copyFileSync('astro.config.cloudflare.mjs', 'astro.config.mjs');

    // Build the project
    print('status', 'Building project...');
    run('yarn build');

    // Verify build output
    print('status', 'Verifying build output...');
    console.log('=== Build output structure ===');
    run('ls -la dist/');

    if (existsSync('dist/_worker.js')) {
      print('success', 'Found _worker.js');
    } else {
      print('warning', 'Missing _worker.js - checking for functions directory');
      if (existsSync('dist/_worker')) {
        console.log('Found _worker directory:');
        run('ls -la dist/_worker/');
      }
    }

    // Check if wrangler is available
    print('status', 'Checking Wrangler...');
    const wranglerCheck = run('yarn list wrangler --depth=0', { silent: true, allowFailure: true });
    if (!wranglerCheck || !wranglerCheck.includes('wrangler')) {
      print('status', 'Installing Wrangler...');
      run('yarn add wrangler --dev');
    } else {
      print('success', 'Wrangler already installed');
    }

    // Determine branch for deployment
    const branch = environment === 'production' ? 'main' : 'staging';

    // Deploy to Cloudflare Pages
    print('status', 'Deploying to Cloudflare Pages...');
    console.log(`Project: weeb-${environment}`);
    console.log(`Branch: ${branch}`);

    run(`yarn wrangler pages deploy ./dist --project-name=weeb-${environment} --branch=${branch}`);

    print('success', `Successfully deployed ${tag} to ${environment}`);
    console.log('');
    print('success', `🌐 Deployment URL: https://weeb-${environment}.pages.dev`);

  } catch (error) {
    print('error', `Deployment failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Restore original config
    if (existsSync('astro.config.mjs.bak')) {
      copyFileSync('astro.config.mjs.bak', 'astro.config.mjs');
      run('rm astro.config.mjs.bak');
      print('status', 'Restored original astro.config.mjs');
    }
  }
}

main();