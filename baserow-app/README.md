# Baserow App

A Baserow-style interface built with Next.js 14 and Supabase. This project replicates the Baserow frontend (Grid, Kanban, Calendar, Form, Record View) using Supabase as the backend.

## Features

- **Multiple View Types**: Grid, Form, Kanban, Calendar, and Interface Page (block builder)
- **Supabase Backend**: All data stored in Supabase with Row Level Security (RLS)
- **Access Controls**: Public, authenticated, role-based, and owner access controls
- **Block System**: Add blocks to interface pages using react-grid-layout
- **Serverless**: Fully compatible with Vercel deployment
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- A Supabase project

### Installation

1. Install dependencies:
```bash
cd baserow-app
npm install
```

2. Set up environment variables:
Create `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Set up the database schema:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the SQL from `supabase/schema.sql`

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
baserow-app/
├── app/                    # Next.js app directory
│   ├── tables/            # Table management pages
│   ├── login/             # Authentication
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── views/             # View components (Grid, Form, Kanban, etc.)
│   └── blocks/            # Block components for interface pages
├── lib/
│   ├── supabase/          # Supabase client setup
│   ├── crud/              # CRUD helpers
│   ├── access-control.ts  # Access control utilities
│   └── utils.ts           # Utility functions
├── supabase/
│   └── schema.sql         # Database schema
└── types/
    └── database.ts        # TypeScript types
```

## View Types

### Grid View
A spreadsheet-like table view with inline editing, filtering, and sorting.

### Form View
A form-based view for creating and editing records.

### Kanban View
A kanban board view that groups records by a selected field.

### Calendar View
A calendar view that displays records based on a date field.

### Interface Page
A block-based page builder using react-grid-layout.

## Block System

Interface pages can include blocks arranged using react-grid-layout. Supported block types:

- **Text**: Rich text content
- **Image**: Display images
- **Chart**: Data visualization (placeholder)
- **KPI**: Key performance indicators
- **HTML**: Custom HTML content
- **Embed**: Embed external content
- **Table**: Embed another table view
- **Automation**: Automation workflow display

## Access Controls

Tables support four access control levels:

- **Public**: Accessible to everyone
- **Authenticated**: Requires login
- **Owner**: Only the creator can access
- **Role-based**: Currently treated as authenticated (can be extended)

## Deployment

### Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

The project is configured for Vercel with `vercel.json`.

## Database Schema

The database schema includes:

- `tables`: Core table definitions
- `views`: View configurations
- `view_fields`: Field visibility and order in views
- `view_filters`: Filter rules
- `view_sorts`: Sorting configuration
- `view_blocks`: Block configurations for interface pages
- `automations`: Automation workflows
- `table_rows`: Dynamic row data stored as JSONB

All tables have Row Level Security (RLS) enabled with appropriate policies.

## License

Private project
