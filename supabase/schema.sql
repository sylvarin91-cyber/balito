-- Balito Shift Handover Tool - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Teams table
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- Team members table
create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

-- Shifts table
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'active' check (status in ('active', 'completed'))
);

-- Handovers table
create table if not exists handovers (
  id uuid primary key default uuid_generate_v4(),
  shift_id uuid references shifts(id) on delete cascade,
  content text not null,
  priority text default 'normal' check (priority in ('urgent', 'normal', 'resolved')),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table teams enable row level security;
alter table team_members enable row level security;
alter table shifts enable row level security;
alter table handovers enable row level security;

-- RLS Policies

-- Teams: Users can only see teams they belong to
create policy "Users can view their teams" on teams
  for select using (
    id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Team members: Users can see members of their teams
create policy "Users can view team members" on team_members
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Shifts: Users can see shifts in their teams
create policy "Users can view team shifts" on shifts
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Shifts: Users can insert shifts in their teams
create policy "Users can create shifts" on shifts
  for insert with check (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Shifts: Users can update their own shifts
create policy "Users can update own shifts" on shifts
  for update using (user_id = auth.uid());

-- Handovers: Users can see handovers for shifts in their teams
create policy "Users can view team handovers" on handovers
  for select using (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

-- Handovers: Users can insert handovers for shifts in their teams
create policy "Users can create handovers" on handovers
  for insert with check (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

-- Handovers: Users can update handovers for shifts in their teams
create policy "Users can update team handovers" on handovers
  for update using (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

-- Indexes for performance
create index if not exists idx_shifts_user_id on shifts(user_id);
create index if not exists idx_shifts_team_id on shifts(team_id);
create index if not exists idx_shifts_status on shifts(status);
create index if not exists idx_handovers_shift_id on handovers(shift_id);
create index if not exists idx_team_members_user_id on team_members(user_id);
create index if not exists idx_team_members_team_id on team_members(team_id);
