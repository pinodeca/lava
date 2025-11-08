# Deployment Instructions

## GitHub Pages Setup

To deploy the application to GitHub Pages, you need to enable it in the repository settings:

1. Go to your repository on GitHub
2. Click on **Settings**
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. The workflow will automatically deploy on push to the `main` branch

## Deployment Workflow

The `.github/workflows/deploy.yml` file contains the GitHub Actions workflow that:
- Installs dependencies
- Builds the production app
- Deploys to GitHub Pages

## Manual Deployment

You can also manually trigger the deployment:
1. Go to the **Actions** tab
2. Select the "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

## Viewing the Deployed App

After deployment, your app will be available at:
`https://pinodeca.github.io/lava/`

Note: The first deployment may take a few minutes to complete.
