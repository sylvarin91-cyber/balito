# Balito - Shift Handover Tool

A simple shift handover tool for small factories, workshops, and 24/7 operations. Log status, flag issues, and hand over to the next shift.

## Features

- **Shift Tracking** - Clock in/out with automatic timestamps
- **Handover Notes** - Log what happened during your shift
- **Issue Flags** - Mark urgent issues that need attention
- **Team Access** - Everyone sees the same information

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project" and give it a name
3. Note your **Project URL** and **Anon Key** from Settings > API

### 2. Set Up Database

1. In your Supabase dashboard, go to SQL Editor
2. Copy and paste the contents of `supabase/schema.sql`
3. Click "Run" to create all tables and policies

### 3. Configure Environment

1. Copy `.env.local.example` to `.env.local`
2. Add your Supabase URL and Anon Key:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Development Server

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables
5. Deploy

## Database Schema

- **teams** - Workspaces for teams
- **team_members** - Users belonging to teams
- **shifts** - Individual shift records
- **handovers** - Notes and issue flags for each shift

## Monetization Ideas

- **Freemium:** Free for small teams, paid for advanced features
- **Per-user pricing:** $8-15/month per team member
- **Lifetime deals:** One-time payment for early adopters

## Next Steps

- [ ] Add email notifications for urgent flags
- [ ] Create team invite system
- [ ] Add shift scheduling calendar
- [ ] Build mobile app
- [ ] Add reporting and analytics
