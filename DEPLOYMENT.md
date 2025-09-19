# Deployment Guide

## Cloudflare Pages Deployment with SSR

This project supports automated deployment to Cloudflare Pages with Server-Side Rendering (SSR) using GitHub Actions.

### Prerequisites

Before deploying, ensure you have the following secrets configured in your GitHub repository:

1. **CLOUDFLARE_API_TOKEN**: Your Cloudflare API token with the following permissions:
   - Zone:Zone:Read
   - Account:Cloudflare Pages:Edit

2. **CLOUDFLARE_ACCOUNT_ID**: Your Cloudflare Account ID

### Setting up Secrets

1. Go to your GitHub repository
2. Navigate to `Settings` → `Secrets and variables` → `Actions`
3. Add the following repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

### Deployment Process

#### 1. Manual Deployment via GitHub Actions

1. Go to your repository on GitHub
2. Navigate to `Actions` → `Deploy to Cloudflare Pages`
3. Click `Run workflow`
4. Select:
   - **Tag**: Choose from available Git tags (e.g., v1.74.1)
   - **Environment**: Choose `staging` or `production`
5. Click `Run workflow`

#### 2. Updating Available Tags

The workflow includes a predefined list of Git tags. To update this list with the latest tags:

```bash
# Run the update script
yarn update-deployment-tags

# Or run directly
node scripts/update-deployment-tags.js
```

This script will:
- Fetch the latest Git tags from your repository
- Update the GitHub Action workflow file with the newest tags
- Show up to 15 most recent version tags

#### 3. Environments

- **Staging**: Deploys to `weeb-frontend-staging.pages.dev`
- **Production**: Deploys to `weeb-frontend-production.pages.dev`

### Configuration Files

- **astro.config.mjs**: Default configuration (Node.js adapter for local development)
- **astro.config.cloudflare.mjs**: Cloudflare-specific configuration with Cloudflare adapter
- **scripts/update-deployment-tags.js**: Script to refresh available deployment tags

### Environment Variables

The deployment process sets the following environment variables:

- `APP_CONFIG`: Set to the selected environment (`staging` or `production`)
- `VITE_APP_VERSION`: Set to the selected Git tag

### Cloudflare Pages Setup

Your Cloudflare Pages projects should be configured as:

- **Staging Project**: `weeb-frontend-staging`
- **Production Project**: `weeb-frontend-production`

### SSR Configuration

The project uses Astro's SSR capabilities with the Cloudflare adapter, providing:

- Server-side rendering for better SEO and performance
- Edge computing capabilities
- Automatic static asset optimization
- Dynamic route handling

### Troubleshooting

#### Common Issues

1. **Build Failures**:
   - Check that all environment variables are properly set
   - Ensure the selected tag exists in the repository
   - Verify dependencies are compatible with Cloudflare Workers runtime

2. **Deployment Failures**:
   - Verify Cloudflare API token has correct permissions
   - Check that the Cloudflare Pages project exists
   - Ensure account ID is correct

3. **Runtime Errors**:
   - Check Cloudflare Workers logs for detailed error information
   - Verify compatibility with Cloudflare Workers runtime limitations

#### Logs and Monitoring

- GitHub Actions logs: Available in the Actions tab of your repository
- Cloudflare Pages logs: Available in your Cloudflare dashboard under Pages
- Runtime logs: Check Cloudflare Workers logs for SSR-related issues

### Next Steps

After successful deployment:

1. Set up custom domains in Cloudflare Pages
2. Configure environment-specific DNS records
3. Set up monitoring and alerts
4. Configure branch-based deployments if needed