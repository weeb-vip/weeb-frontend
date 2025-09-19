#!/usr/bin/env node

/**
 * Script to automatically update the GitHub Action workflow with the latest Git tags
 * Run this script whenever you want to refresh the available tags for deployment
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const WORKFLOW_PATH = '.github/workflows/deploy-cloudflare.yml';
const MAX_TAGS = 15; // Maximum number of tags to show in the dropdown

function getLatestTags() {
  try {
    const output = execSync('git tag --sort=-version:refname', { encoding: 'utf8' });
    return output.trim().split('\n').filter(tag => tag.startsWith('v')).slice(0, MAX_TAGS);
  } catch (error) {
    console.error('Error fetching git tags:', error.message);
    process.exit(1);
  }
}

function updateWorkflowFile(tags) {
  const workflowPath = resolve(WORKFLOW_PATH);

  try {
    let content = readFileSync(workflowPath, 'utf8');

    // Create the new options section
    const optionsSection = tags.map(tag => `          - ${tag}`).join('\n');

    // Replace the existing options section
    const optionsRegex = /(\s+options:\s*\n)(\s+-\s+v[\d.]+\n)*/;
    content = content.replace(optionsRegex, `$1${optionsSection}\n`);

    writeFileSync(workflowPath, content);
    console.log(`✅ Updated ${WORKFLOW_PATH} with ${tags.length} latest tags:`);
    tags.forEach(tag => console.log(`   - ${tag}`));
  } catch (error) {
    console.error('Error updating workflow file:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🔄 Fetching latest Git tags...');
  const tags = getLatestTags();

  if (tags.length === 0) {
    console.warn('⚠️  No version tags found');
    return;
  }

  console.log(`📋 Found ${tags.length} tags to include in deployment options`);
  updateWorkflowFile(tags);

  console.log('\n🚀 To deploy, go to:');
  console.log('   GitHub → Actions → Deploy to Cloudflare Pages → Run workflow');
}

main();