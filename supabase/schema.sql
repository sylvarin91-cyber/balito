-- Balito - Database Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- TABLES
-- ============================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_id uuid references organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  join_code text,
  created_at timestamptz default now()
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

create table team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  code text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create table shift_schedules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  shift_name text not null,
  start_hour int not null,
  start_minute int not null default 0,
  end_hour int not null,
  end_minute int not null default 0,
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  schedule_id uuid references shift_schedules(id) on delete set null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'active' check (status in ('active', 'completed', 'scheduled')),
  shift_date date,
  shift_name text
);

create table handovers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete cascade,
  content text not null,
  priority text default 'normal' check (priority in ('urgent', 'normal', 'resolved')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_org_members_user_id on org_members(user_id);
create index idx_org_members_org_id on org_members(org_id);
create index idx_teams_org_id on teams(org_id);
create index idx_teams_join_code on teams(join_code);
create index idx_team_members_user_id on team_members(user_id);
create index idx_team_members_team_id on team_members(team_id);
create index idx_shifts_team_id on shifts(team_id);
create index idx_shifts_user_id on shifts(user_id);
create index idx_shifts_status on shifts(status);
create index idx_handovers_shift_id on handovers(shift_id);

-- ============================================================
-- ENABLE RLS
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
-- Rule: NEVER query a table from its own policy (causes infinite recursion)
-- ============================================================

-- ORGANIZATIONS
create policy "org_insert" on organizations
  for insert with check (auth.uid() is not null);

create policy "org_select" on organizations
  for select using (
    id in (select org_id from org_members where user_id = auth.uid())
  );

-- ORG_MEMBERS
create policy "org_members_select" on org_members
  for select using (user_id = auth.uid());

create policy "org_members_insert" on org_members
  for insert with check (user_id = auth.uid());

create policy "org_members_delete" on org_members
  for delete using (user_id = auth.uid());

-- TEAMS
create policy "teams_select" on teams
  for select using (
    org_id in (select org_id from org_members where user_id = auth.uid())
    or id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "teams_insert" on teams
  for insert with check (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "teams_update" on teams
  for update using (
    id in (select team_id from team_members where user_id = auth.uid() and role = 'admin')
  );

-- TEAM_MEMBERS
create policy "tm_select" on team_members
  for select using (user_id = auth.uid());

create policy "tm_insert" on team_members
  for insert with check (user_id = auth.uid());

create policy "tm_delete" on team_members
  for delete using (user_id = auth.uid());

-- TEAM_INVITES
create policy "ti_manage" on team_invites
  for all using (
    team_id in (select team_id from team_members where user_id = auth.uid() and role = 'admin')
  );

create policy "ti_read" on team_invites
  for select using (true);

-- SHIFT_SCHEDULES
create policy "ss_select" on shift_schedules
  for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "ss_manage" on shift_schedules
  for all using (
    team_id in (select team_id from team_members where user_id = auth.uid() and role = 'admin')
  );

-- SHIFTS
create policy "shifts_select" on shifts
  for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "shifts_manage" on shifts
  for all using (
    team_id in (select team_id from team_members where user_id = auth.uid() and role = 'admin')
  );

create policy "shifts_update_own" on shifts
  for update using (user_id = auth.uid());

-- HANDOVERS
create policy "handovers_select" on handovers
  for select using (
    shift_id in (select id from shifts where team_id in (
      select team_id from team_members where user_id = auth.uid()
    ))
  );

create policy "handovers_insert" on handovers
  for insert with check (
    shift_id in (select id from shifts where team_id in (
      select team_id from team_members where user_id = auth.uid()
    ))
  );

create policy "handovers_update" on handovers
  for update using (
    shift_id in (select id from shifts where team_id in (
      select team_id from team_members where user_id = auth.uid()
    ))
  );
