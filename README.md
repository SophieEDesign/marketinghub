# Marketing Hub

A comprehensive marketing management system built with Next.js, Supabase, and TypeScript.

## Quick Start

1. **Database Setup**: Run `supabase-all-tables-migration.sql` in Supabase SQL Editor
2. **Environment Variables**: Configure `.env.local` with Supabase credentials
3. **Install Dependencies**: `npm install`
4. **Run Development Server**: `npm run dev`

## Key Features

- **Dynamic Tables**: Create and manage custom data tables
- **Multiple Views**: Grid, Kanban, Calendar, Timeline, and Card views
- **Custom Pages**: Build custom interface pages with drag-and-drop blocks
- **Dashboard**: Customizable dashboard with multiple block types
- **Import/Export**: CSV import and data export functionality

## Documentation

- **Migrations**: See `MIGRATIONS_README.md` for database setup
- **Dashboard**: See `DASHBOARD_IMPLEMENTATION_REVIEW.md` for dashboard system
- **Setup**: See `SETUP.md` for detailed setup instructions

## Project Structure

```
app/              # Next.js app router pages
components/       # React components
lib/             # Utilities, hooks, and helpers
supabase-*.sql   # Database migration files
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with shadcn/ui patterns
- **Drag & Drop**: @dnd-kit
- **Rich Text**: TipTap

---

# Marketing Hub

A comprehensive marketing workspace built with Next.js and Supabase, featuring multiple views for content management.

## Features

- 📊 **Grid View** - Table-based content management
- 📋 **Kanban Board** - Drag-and-drop workflow management
- 📅 **Calendar View** - Schedule and timeline visualization
- 📈 **Timeline/Gantt View** - Project timeline visualization
- 🎴 **Cards View** - Visual gallery of content
- ⚙️ **Settings** - Customizable branding, colors, and fields
- 🌓 **Themes** - Light, Dark, and Brand themes
- 📁 **File Uploads** - Attach files to content items
- 🎨 **Custom Fields** - Add custom fields to content table

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account and project

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
  - `branding/` - Logo and branding components
  - `chips/` - Status and channel badges
  - `drawer/` - Record editing drawer
  - `grid/` - Grid view components
  - `kanban/` - Kanban board components
  - `settings/` - Settings management
  - `views/` - View configuration
- `lib/` - Utility functions and Supabase client setup
- `types/` - TypeScript type definitions

## Deployment

See `QUICK_DEPLOY.md` for deployment instructions to Vercel.

## Supabase Setup

See `SUPABASE_SETUP.md` for required Supabase configuration.

## Documentation

- `SETUP.md` - Detailed setup instructions
- `DEPLOYMENT.md` - Full deployment guide
- `QUICK_DEPLOY.md` - Quick deployment steps
- `SUPABASE_SETUP.md` - Supabase configuration
- `PROJECT_CHECKLIST.md` - Complete file checklist

