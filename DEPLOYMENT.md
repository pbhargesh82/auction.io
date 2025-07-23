# Deploying Auction.io to Netlify

## Prerequisites

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Supabase Project**: Ensure your Supabase project is set up and running

## Step 1: Configure Environment Variables

Before deploying, you need to set up your Supabase environment variables in Netlify:

### In Netlify Dashboard:
1. Go to your site settings
2. Navigate to "Environment variables"
3. Add the following variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Update Environment Files:

**src/environments/environment.prod.ts:**
```typescript
export const environment = {
  production: true,
  supabase: {
    url: process.env['SUPABASE_URL'] || 'YOUR_SUPABASE_URL',
    anonKey: process.env['SUPABASE_ANON_KEY'] || 'YOUR_SUPABASE_ANON_KEY'
  }
};
```

## Step 2: Deploy to Netlify

### Option A: Deploy via Netlify UI (Recommended)

1. **Connect to GitHub:**
   - Log in to Netlify
   - Click "New site from Git"
   - Choose GitHub and authorize Netlify
   - Select your repository

2. **Configure Build Settings:**
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/auction.io`
   - **Node version**: 18 (or latest LTS)

3. **Deploy:**
   - Click "Deploy site"
   - Netlify will automatically build and deploy your app

### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Build your project:**
   ```bash
   npm run build
   ```

4. **Deploy:**
   ```bash
   netlify deploy --prod --dir=dist/auction.io
   ```

## Step 3: Configure Custom Domain (Optional)

1. In Netlify dashboard, go to "Domain settings"
2. Click "Add custom domain"
3. Follow the DNS configuration instructions

## Step 4: Set up Continuous Deployment

Netlify automatically sets up continuous deployment:
- Every push to your main branch triggers a new deployment
- Pull requests create preview deployments

## Troubleshooting

### Common Issues:

1. **Build Fails:**
   - Check that all dependencies are in `package.json`
   - Ensure Node.js version is compatible (18+)
   - Verify environment variables are set correctly

2. **Routing Issues:**
   - The `_redirects` file handles Angular routing
   - Ensure `netlify.toml` is in your repository root

3. **Environment Variables:**
   - Double-check Supabase URL and key in Netlify dashboard
   - Ensure variables are named exactly as expected

### Build Commands:

```bash
# Local build test
npm run build

# Check build output
ls -la dist/auction.io

# Test production build locally
npm run build && npx serve dist/auction.io
```

## Security Notes

- Never commit sensitive environment variables to your repository
- Use Netlify's environment variable system for secrets
- Ensure your Supabase RLS policies are properly configured

## Performance Optimization

- The production build includes optimizations like:
  - Tree shaking
  - Minification
  - Asset optimization
  - Service worker (if configured)

## Support

If you encounter issues:
1. Check Netlify build logs
2. Verify environment variables
3. Test locally with production build
4. Check Angular and Netlify documentation 