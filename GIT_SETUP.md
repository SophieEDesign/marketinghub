# Git Setup & Push to GitHub

## Step-by-Step Instructions

Since Git isn't available in this terminal, follow these steps in your own terminal (Git Bash, PowerShell, or Command Prompt):

### 1. Open Terminal/Git Bash
Navigate to your project folder:
```bash
cd "C:\Users\Sophie.Edgerley\OneDrive - Peters&May\Marketing\Website\2025\Marketing Hub"
```

### 2. Initialize Git Repository
```bash
git init
```

### 3. Add All Files
```bash
git add .
```

### 4. Create Initial Commit
```bash
git commit -m "first commit"
```

### 5. Rename Branch to Main
```bash
git branch -M main
```

### 6. Add Remote Repository
```bash
git remote add origin https://github.com/SophieEDesign/marketinghub.git
```

### 7. Push to GitHub
```bash
git push -u origin main
```

## Alternative: Using GitHub Desktop

If you prefer a GUI:

1. **Download GitHub Desktop** (if not installed): https://desktop.github.com/
2. **Open GitHub Desktop**
3. **File → Add Local Repository**
4. Select your project folder
5. **Publish repository** (button in top right)
6. Repository name: `marketinghub`
7. Click **"Publish Repository"**

## Important: Before Pushing

### Create `.env.local` file (DO NOT commit this!)
Create a file named `.env.local` in the root with:
```
NEXT_PUBLIC_SUPABASE_URL=https://hwtycgvclhckglmuwnmw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dHljZ3ZjbGhja2dsbXV3bm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Mzg0OTIsImV4cCI6MjA3OTAxNDQ5Mn0.-yOyserJWJgp0WByBxlOBpksNOGdRJTJ-fUiS6lS-H8
```

This file is already in `.gitignore`, so it won't be committed.

## After Pushing to GitHub

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your `marketinghub` repository
4. Add environment variables (same as `.env.local`)
5. Click "Deploy"

## Troubleshooting

**If "git is not recognized":**
- Install Git: https://git-scm.com/download/win
- Or use GitHub Desktop (GUI option)

**If push fails:**
- Make sure the repository exists on GitHub
- Check you're authenticated: `git config --global user.name "Your Name"`
- Try: `git push -u origin main --force` (only if repository is empty)

**If authentication fails:**
- Use Personal Access Token instead of password
- GitHub → Settings → Developer settings → Personal access tokens

