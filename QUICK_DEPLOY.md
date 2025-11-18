# Quick Deployment Guide

## Deploy via Vercel Dashboard (Recommended)

### Step 1: Prepare Your Code
1. Make sure all your files are saved
2. If using Git, commit and push your code to GitHub/GitLab/Bitbucket
3. If not using Git, you can zip the project folder

### Step 2: Deploy to Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in (or create an account)

2. **Create New Project**
   - Click "Add New..." → "Project"
   - If your code is on GitHub/GitLab/Bitbucket:
     - Select your repository
     - Click "Import"
   - If not using Git:
     - Use Vercel CLI (requires Node.js) or
     - Push to a Git repository first

3. **Configure Project**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Add Environment Variables**
   - Click "Environment Variables"
   - Add these two variables:
   
   **Variable 1:**
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://hwtycgvclhckglmuwnmw.supabase.co`
   - Environment: Production, Preview, Development (select all)
   
   **Variable 2:**
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dHljZ3ZjbGhja2dsbXV3bm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Mzg0OTIsImV4cCI6MjA3OTAxNDQ5Mn0.-yOyserJWJgp0WByBxlOBpksNOGdRJTJ-fUiS6lS-H8`
   - Environment: Production, Preview, Development (select all)

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (2-5 minutes)
   - Your app will be live at: `https://your-project-name.vercel.app`

## Important: Supabase Setup

Before the app works fully, you need to:

1. **Create Storage Buckets in Supabase:**
   - Go to Supabase Dashboard → Storage
   - Create bucket: `attachments` (for file uploads)
   - Create bucket: `branding` (for logos)
   - Set both to **Public** or configure RLS policies

2. **Create Settings Table in Supabase:**
   - Go to Supabase Dashboard → SQL Editor
   - Run this SQL:
   ```sql
   CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

3. **Create Content Table** (if not exists):
   - Ensure your `content` table has these columns at minimum:
     - id (uuid, primary key)
     - title (text)
     - status (text)
     - channels (text[])
     - description (text)
     - publish_date (date)
     - content_type (text)
     - thumbnail_url (text)
     - created_at (timestamp)
     - updated_at (timestamp)
     - campaigns (foreign key to campaigns table)

## Post-Deployment

1. Visit your deployed URL
2. Test all features:
   - Create new content
   - Upload logo in settings
   - Test all views (Grid, Kanban, Calendar, Timeline, Cards)
   - Test drawer functionality
   - Test theme switching

## Troubleshooting

- **Build fails**: Check Vercel build logs for errors
- **Environment variables not working**: Ensure they're set for all environments
- **Storage errors**: Verify buckets exist and are public
- **Database errors**: Check table structure matches expectations

