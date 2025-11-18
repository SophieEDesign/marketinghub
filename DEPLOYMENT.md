# Deployment Guide

## Prerequisites

1. Install Vercel CLI (if deploying via CLI):
   ```bash
   npm i -g vercel
   ```

2. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

## Environment Variables

Before deploying, ensure you have the following environment variables set:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Deployment Options

### Option 1: Deploy via Vercel CLI

1. Build the project locally to check for errors:
   ```bash
   npm run build
   ```

2. Deploy to Vercel:
   ```bash
   npx vercel deploy
   ```

   Or for production:
   ```bash
   npx vercel deploy --prod
   ```

### Option 2: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub/GitLab/Bitbucket account
3. Click "New Project"
4. Import your repository
5. Configure environment variables in the project settings:
   - Go to Settings → Environment Variables
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://hwtycgvclhckglmuwnmw.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
6. Click "Deploy"

## Supabase Storage Setup

For file uploads to work, you need to:

1. Create a storage bucket named `attachments` in Supabase
2. Set bucket policies to allow authenticated uploads
3. Optionally, set up RLS (Row Level Security) policies

## Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test creating new content items
- [ ] Test file uploads (ensure storage bucket exists)
- [ ] Test all views (Grid, Kanban, Calendar, Timeline, Cards)
- [ ] Test drawer functionality
- [ ] Verify dark mode works
- [ ] Check mobile responsiveness

## Troubleshooting

### Build Errors
- Ensure all dependencies are in `package.json`
- Check TypeScript errors: `npm run lint`
- Verify Next.js version compatibility

### Environment Variable Issues
- Ensure variables start with `NEXT_PUBLIC_` for client-side access
- Check Vercel dashboard → Settings → Environment Variables

### File Upload Issues
- Verify Supabase storage bucket exists
- Check bucket policies allow uploads
- Ensure RLS policies are configured if using authentication

