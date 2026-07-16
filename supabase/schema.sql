-- Balito Shift Handover Tool - Database Migration
-- Run this in your Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. NEW TABLES (only created if they don't exist)
-- ============================================================

-- Organizations (flexible hierarchy via parent_id)
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  parent_id uuid references organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Org members
create table if not exists org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- Team invites
create table if not exists team_invites (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  code text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Shift schedules (templates)
create table if not exists shift_schedules (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  shift_name text not null,
  start_hour int not null check (start_hour >= 0 and start_hour < 24),
  start_minute int not null default 0 check (start_minute >= 0 and start_minute < 60),
  end_hour int not null check (end_hour >= 0 and end_hour < 24),
  end_minute int not null default 0 check (end_minute >= 0 and end_minute < 60),
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. ADD COLUMNS TO EXISTING TABLES (safe with IF NOT EXISTS)
-- ============================================================

-- Teams: add org_id, created_by, join_code
DO $$ BEGIN
  ALTER TABLE teams ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Make existing teams columns nullable if needed (for backward compat)
DO $$ BEGIN
  ALTER TABLE teams ALTER COLUMN name DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; WHEN others THEN NULL;
END $$;

-- Shifts: add schedule_id, shift_date, shift_name
DO $$ BEGIN
  ALTER TABLE shifts ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES shift_schedules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_date date;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_name text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update shifts status check to include 'scheduled'
DO $$ BEGIN
  ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_status_check;
  ALTER TABLE shifts ADD CONSTRAINT shifts_status_check CHECK (status IN ('active', 'completed', 'scheduled'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Handovers: add created_by
DO $$ BEGIN
  ALTER TABLE handovers ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 3. INDEXES (only created if they don't exist)
-- ============================================================

create index if not exists idx_organizations_parent_id on organizations(parent_id);
create index if not exists idx_organizations_created_by on organizations(created_by);
create index if not exists idx_org_members_org_id on org_members(org_id);
create index if not exists idx_org_members_user_id on org_members(user_id);
create index if not exists idx_teams_org_id on teams(org_id);
create index if not exists idx_teams_created_by on teams(created_by);
create index if not exists idx_teams_join_code on teams(join_code);
create index if not exists idx_team_invites_team_id on team_invites(team_id);
create index if not exists idx_team_invites_code on team_invites(code);
create index if not exists idx_team_invites_email on team_invites(email);
create index if not exists idx_shift_schedules_team_id on shift_schedules(team_id);
create index if not exists idx_shifts_user_id on shifts(user_id);
create index if not exists idx_shifts_team_id on shifts(team_id);
create index if not exists idx_shifts_status on shifts(status);
create index if not exists idx_shifts_shift_date on shifts(shift_date);
create index if not exists idx_handovers_shift_id on handovers(shift_id);
create index if not exists idx_team_members_user_id on team_members(user_id);
create index if not exists idx_team_members_team_id on team_members(team_id);

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table shift_schedules enable row level security;
alter table shifts enable row level security;
alter table handovers enable row level security;

-- ============================================================
-- 5. DROP OLD POLICIES (if they exist) THEN CREATE NEW ONES
-- ============================================================

-- Organizations
drop policy if exists "Users can view their organizations" on organizations;
drop policy if exists "Authenticated users can create organizations" on organizations;
drop policy if exists "Org owners and admins can update" on organizations;

create policy "Users can view their organizations" on organizations
  for select using (
    id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

create policy "Authenticated users can create organizations" on organizations
  for insert with check (auth.uid() is not null);

create policy "Org owners and admins can update" on organizations
  for update using (
    id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Org members
drop policy if exists "Users can view org members" on org_members;
drop policy if exists "Org owners and admins can add members" on org_members;
drop policy if exists "Org owners can remove members" on org_members;

create policy "Users can view org members" on org_members
  for select using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

create policy "Org owners and admins can add members" on org_members
  for insert with check (
    org_id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Org owners can remove members" on org_members
  for delete using (
    org_id in (
      select org_id from org_members where user_id = auth.uid() and role = 'owner'
    )
  );

-- Teams (drop old policies first)
drop policy if exists "Users can view their teams" on teams;
drop policy if exists "Users can view org teams" on teams;
drop policy if exists "Org admins can create teams" on teams;
drop policy if exists "Team admins can update team" on teams;

create policy "Users can view org teams" on teams
  for select using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
    or
    id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

create policy "Org admins can create teams" on teams
  for insert with check (
    org_id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Team admins can update team" on teams
  for update using (
    id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
  );

-- Team members (drop old policies first)
drop policy if exists "Users can view team members" on team_members;
drop policy if exists "Team admins can add members" on team_members;
drop policy if exists "Team admins can remove members" on team_members;

create policy "Users can view team members" on team_members
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
    or
    team_id in (
      select id from teams where org_id in (
        select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

create policy "Team admins can add members" on team_members
  for insert with check (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
    or
    team_id in (
      select id from teams where org_id in (
        select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

create policy "Team admins can remove members" on team_members
  for delete using (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
    or
    team_id in (
      select id from teams where org_id in (
        select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

-- Team invites
drop policy if exists "Team admins can manage invites" on team_invites;
drop policy if exists "Anyone can read invite by code" on team_invites;

create policy "Team admins can manage invites" on team_invites
  for all using (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
    or
    team_id in (
      select id from teams where org_id in (
        select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

create policy "Anyone can read invite by code" on team_invites
  for select using (true);

-- Shift schedules
drop policy if exists "Team members can view schedules" on shift_schedules;
drop policy if exists "Team admins can manage schedules" on shift_schedules;

create policy "Team members can view schedules" on shift_schedules
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

create policy "Team admins can manage schedules" on shift_schedules
  for all using (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
  );

-- Shifts (drop old policies first)
drop policy if exists "Users can view team shifts" on shifts;
drop policy if exists "Users can create shifts" on shifts;
drop policy if exists "Team admins can manage shifts" on shifts;
drop policy if exists "Users can update own shifts" on shifts;

create policy "Users can view team shifts" on shifts
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

create policy "Team admins can manage shifts" on shifts
  for all using (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can update own shifts" on shifts
  for update using (user_id = auth.uid());

-- Handovers (drop old policies first)
drop policy if exists "Users can view team handovers" on handovers;
drop policy if exists "Users can create handovers" on handovers;
drop policy if exists "Users can update team handovers" on handovers;

create policy "Users can view team handovers" on handovers
  for select using (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can create handovers" on handovers
  for insert with check (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can update team handovers" on handovers
  for update using (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );
