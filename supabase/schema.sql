-- Balito Shift Handover Tool - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS (flexible hierarchy via parent_id)
-- ============================================================
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  parent_id uuid references organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_organizations_parent_id on organizations(parent_id);
create index if not exists idx_organizations_created_by on organizations(created_by);

-- ============================================================
-- ORG MEMBERS
-- ============================================================
create table if not exists org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

create index if not exists idx_org_members_org_id on org_members(org_id);
create index if not exists idx_org_members_user_id on org_members(user_id);

-- ============================================================
-- TEAMS (updated with org_id and join_code)
-- ============================================================
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  org_id uuid references organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  join_code text unique,
  created_at timestamptz default now()
);

create index if not exists idx_teams_org_id on teams(org_id);
create index if not exists idx_teams_created_by on teams(created_by);
create index if not exists idx_teams_join_code on teams(join_code);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

-- ============================================================
-- TEAM INVITES (email-based invitations)
-- ============================================================
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

create index if not exists idx_team_invites_team_id on team_invites(team_id);
create index if not exists idx_team_invites_code on team_invites(code);
create index if not exists idx_team_invites_email on team_invites(email);

-- ============================================================
-- SHIFT SCHEDULES (templates for recurring/one-off shifts)
-- ============================================================
create table if not exists shift_schedules (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  shift_name text not null,
  start_hour int not null check (start_hour >= 0 and start_hour < 24),
  start_minute int not null default 0 check (start_minute >= 0 and start_minute < 60),
  end_hour int not null check (end_hour >= 0 and end_hour < 24),
  end_minute int not null default 0 check (end_minute >= 0 and end_minute < 60),
  days_of_week int[] not null default '{0,1,2,3,4,5,6}', -- 0=Sun, 6=Sat
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_shift_schedules_team_id on shift_schedules(team_id);

-- ============================================================
-- SHIFTS (updated with schedule_id and assigned user)
-- ============================================================
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  schedule_id uuid references shift_schedules(id) on delete set null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'active' check (status in ('active', 'completed', 'scheduled')),
  shift_date date,
  shift_name text
);

-- ============================================================
-- HANDOVERS
-- ============================================================
create table if not exists handovers (
  id uuid primary key default uuid_generate_v4(),
  shift_id uuid references shifts(id) on delete cascade,
  content text not null,
  priority text default 'normal' check (priority in ('urgent', 'normal', 'resolved')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
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
-- RLS POLICIES
-- ============================================================

-- Organizations: members can see orgs they belong to
create policy "Users can view their organizations" on organizations
  for select using (
    id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

-- Organizations: authenticated users can create orgs
create policy "Authenticated users can create organizations" on organizations
  for insert with check (auth.uid() is not null);

-- Organizations: owners/admins can update
create policy "Org owners and admins can update" on organizations
  for update using (
    id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Org members: users can see members of their orgs
create policy "Users can view org members" on org_members
  for select using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

-- Org members: owners/admins can add members
create policy "Org owners and admins can add members" on org_members
  for insert with check (
    org_id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Org members: owners can remove members
create policy "Org owners can remove members" on org_members
  for delete using (
    org_id in (
      select org_id from org_members where user_id = auth.uid() and role = 'owner'
    )
  );

-- Teams: users can see teams in their orgs
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

-- Teams: org admins/owners can create teams
create policy "Org admins can create teams" on teams
  for insert with check (
    org_id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Teams: team admins can update their team
create policy "Team admins can update team" on teams
  for update using (
    id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
  );

-- Team members: users can see members of their teams
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

-- Team members: team admins can add members
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

-- Team members: team admins can remove members
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

-- Team invites: team admins can view/create invites
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

-- Team invites: anyone can read by code (for join flow)
create policy "Anyone can read invite by code" on team_invites
  for select using (true);

-- Shift schedules: team members can view schedules
create policy "Team members can view schedules" on shift_schedules
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Shift schedules: team admins can manage schedules
create policy "Team admins can manage schedules" on shift_schedules
  for all using (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
  );

-- Shifts: team members can see shifts in their teams
create policy "Users can view team shifts" on shifts
  for select using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Shifts: team admins can create/update shifts
create policy "Team admins can manage shifts" on shifts
  for all using (
    team_id in (
      select team_id from team_members where user_id = auth.uid() and role = 'admin'
    )
  );

-- Shifts: users can update their own shifts
create policy "Users can update own shifts" on shifts
  for update using (user_id = auth.uid());

-- Handovers: team members can see handovers for shifts in their teams
create policy "Users can view team handovers" on handovers
  for select using (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

-- Handovers: team members can create handovers
create policy "Users can create handovers" on handovers
  for insert with check (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

-- Handovers: team members can update handovers
create policy "Users can update team handovers" on handovers
  for update using (
    shift_id in (
      select id from shifts where team_id in (
        select team_id from team_members where user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
create index if not exists idx_shifts_user_id on shifts(user_id);
create index if not exists idx_shifts_team_id on shifts(team_id);
create index if not exists idx_shifts_status on shifts(status);
create index if not exists idx_shifts_shift_date on shifts(shift_date);
create index if not exists idx_handovers_shift_id on handovers(shift_id);
create index if not exists idx_team_members_user_id on team_members(user_id);
create index if not exists idx_team_members_team_id on team_members(team_id);
