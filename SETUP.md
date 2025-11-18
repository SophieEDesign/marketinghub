# Setup Instructions

## Initial Setup

### 1. Install Dependencies

First, make sure you have Node.js installed (version 18 or higher). Then install all project dependencies:

```bash
npm install
```

This will install all packages listed in `package.json`:
- Next.js 14
- React 18
- Supabase client
- dnd-kit (for drag & drop)
- FullCalendar
- dayjs
- Tailwind CSS
- TypeScript

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hwtycgvclhckglmuwnmw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dHljZ3ZjbGhja2dsbXV3bm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Mzg0OTIsImV4cCI6MjA3OTAxNDQ5Mn0.-yOyserJWJgp0WByBxlOBpksNOGdRJTJ-fUiS6lS-H8
```

**Important:** The `.env.local` file is already in `.gitignore`, so it won't be committed to version control.

### 3. Run the Development Server

Start the development server:

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### 4. Build for Production (Optional)

To test the production build locally:

```bash
npm run build
npm start
```

## Importing to Vercel

### Option 1: Vercel CLI

1. Install Vercel CLI globally:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

   For production:
   ```bash
   vercel --prod
   ```

### Option 2: Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Add environment variables in project settings
6. Click "Deploy"

## Troubleshooting

### "npm is not recognized"
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart your terminal after installation

### Module not found errors
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then run `npm install`

### Environment variables not working
- Ensure `.env.local` is in the root directory
- Restart the dev server after changing `.env.local`
- Variables must start with `NEXT_PUBLIC_` for client-side access

### Port 3000 already in use
- Use a different port: `npm run dev -- -p 3001`
- Or stop the process using port 3000

