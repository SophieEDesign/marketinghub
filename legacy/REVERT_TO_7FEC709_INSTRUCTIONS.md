# Revert to 7fec709 (deployment HuyLAvHUN) – run these locally

Git operations from the IDE hit file locks (often OneDrive or the editor). Run these in a **terminal outside Cursor** (e.g. PowerShell or Git Bash). If you use OneDrive, consider **pausing sync** for this folder first.

## Option A: New branch at 7fec709 (recommended)

Creates a branch that matches the deployment; `main` stays as-is.

```powershell
cd "c:\Users\Sophie.Edgerley\OneDrive - Peters&May\Marketing\Website\2025\Marketing Hub"

# Restore any stashed work first if you want it elsewhere: git stash list
# Then create and switch to the reverted state:
git checkout -b revert-to-7fec709 7fec709
```

Then deploy `revert-to-7fec709` to Vercel, or merge it into `main` when ready.

## Fix: branch already exists but isn’t fully reverted

If `revert-to-7fec709` was created from a later commit and only one file (e.g. CalendarView) was reverted, the app will still show new behaviour (e.g. 21 rows, missing views). To make the branch **exactly** match 7fec709, run in a **terminal outside Cursor** (and pause OneDrive for this folder if you see lock errors):

```powershell
cd "c:\Users\Sophie.Edgerley\OneDrive - Peters&May\Marketing\Website\2025\Marketing Hub"

git checkout revert-to-7fec709
git reset --hard 7fec709
git push --force-with-lease origin revert-to-7fec709
```

Vercel will then redeploy from the true 7fec709 state.

## Option B: Make main point at 7fec709 (destructive)

Discards all commits after 7fec709 on `main`. Only do this if you don’t need to keep that history on `main`.

```powershell
cd "c:\Users\Sophie.Edgerley\OneDrive - Peters&May\Marketing\Website\2025\Marketing Hub"

git checkout main
git reset --hard 7fec709
# To update remote (after backup): git push --force-with-lease origin main
```

## Stash

Your in-progress changes were stashed as: **WIP before revert-to-7fec709**

To see stashes: `git stash list`  
To re-apply after reverting: `git stash pop`

## Implement later

Use [.cursor/plans/revert_to_7fec709_decisions.plan.md](.cursor/plans/revert_to_7fec709_decisions.plan.md) to choose which changes to add back, then cherry-pick those commits onto `revert-to-7fec709`.
