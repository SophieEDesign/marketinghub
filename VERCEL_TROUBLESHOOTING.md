# Vercel 404 Error Troubleshooting

## Common Causes & Solutions

### 1. Check Build Logs
1. Go to your Vercel project dashboard
2. Click on the failed deployment
3. Check the **Build Logs** tab
4. Look for specific error messages

### 2. Common Issues

#### Issue: Build Fails
**Symptoms:** Build logs show errors

**Solutions:**
- Check if all dependencies are in `package.json`
- Verify Node.js version (should be 18+)
- Check for TypeScript errors

#### Issue: Missing Environment Variables
**Symptoms:** App builds but shows errors at runtime

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Redeploy

#### Issue: Routing Problems
**Symptoms:** 404 on all pages

**Solution:**
- Verify `app/` directory structure is correct
- Ensure `app/page.tsx` exists
- Check `app/layout.tsx` is properly configured

#### Issue: Missing Files
**Symptoms:** Import errors in build logs

**Solution:**
- Ensure all files are committed to Git
- Check `.gitignore` isn't excluding needed files
- Verify all imports use correct paths

### 3. Quick Fixes

#### Rebuild from Scratch:
1. Delete the Vercel project
2. Create a new project
3. Import repository again
4. Add environment variables
5. Deploy

#### Check Build Locally:
If you have Node.js installed, test the build:
```bash
npm install
npm run build
```

If this fails locally, fix those errors first.

### 4. Verify Project Structure

Make sure these files exist:
- ✅ `package.json`
- ✅ `next.config.js`
- ✅ `tsconfig.json`
- ✅ `app/layout.tsx`
- ✅ `app/page.tsx`
- ✅ `tailwind.config.ts`
- ✅ `postcss.config.js`

### 5. Vercel Configuration

Create `vercel.json` if needed:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### 6. Check Deployment Settings

In Vercel Dashboard:
- **Framework Preset:** Next.js
- **Root Directory:** `./` (leave empty)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

### 7. Common Build Errors

**"Module not found":**
- Run `npm install` locally and commit `package-lock.json`
- Check all imports are correct

**"TypeScript errors":**
- Fix TypeScript errors locally first
- Run `npm run lint` to check

**"Missing environment variables":**
- Add all `NEXT_PUBLIC_*` variables in Vercel dashboard
- Redeploy after adding

## Still Not Working?

1. **Share the build logs** - Copy the error from Vercel build logs
2. **Check Vercel status** - Visit status.vercel.com
3. **Try a minimal test** - Deploy just `app/page.tsx` to verify setup

## Next Steps

After fixing the issue:
1. Push changes to GitHub
2. Vercel will auto-redeploy
3. Or manually trigger redeploy in Vercel dashboard

