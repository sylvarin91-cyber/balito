-- Balito - Database Schema (Clean Rebuild with Shift Kanban & Tasks)
-- Run this in Supabase SQL Editor to drop and recreate all tables and policies cleanly.

-- ============================================================
-- 1. CLEANUP (DROP Existing Objects in Order of Dependency)
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user cascade;
drop function if exists public.is_org_member cascade;
drop function if exists public.is_org_admin cascade;
drop function if exists public.is_team_member cascade;
drop function if exists public.is_team_admin cascade;
drop function if exists public.is_shift_team_member cascade;

drop table if exists public.task_comments cascade;
drop table if exists public.tasks cascade;
drop table if exists public.handovers cascade;
drop table if exists public.shifts cascade;
drop table if exists public.shift_schedules cascade;
drop table if exists public.team_invites cascade;
drop table if exists public.team_members cascade;
drop table if exists public.teams cascade;
drop table if exists public.org_members cascade;
drop table if exists public.organizations cascade;
drop table if exists public.profiles cascade;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Profiles (exposes user emails to other authenticated users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Organization Members
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- Teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_id uuid references public.organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  join_code text,
  created_at timestamptz default now()
);

-- Team Members
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

-- Team Invites
create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  code text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Shift Schedules
create table public.shift_schedules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  shift_name text not null,
  start_hour int not null,
  start_minute int not null default 0,
  end_hour int not null,
  end_minute int not null default 0,
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Shifts
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  schedule_id uuid references public.shift_schedules(id) on delete set null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'active' check (status in ('active', 'completed', 'scheduled')),
  shift_date date,
  shift_name text,
  check (ended_at is null or ended_at > started_at)
);

-- Handovers
create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete cascade,
  content text not null,
  priority text default 'normal' check (priority in ('urgent', 'normal', 'resolved')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Tasks (Kanban / Operations Action Items)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  description text,
  status text default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'handover_pending', 'completed')),
  priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  target_shift_date date,
  target_shift_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Task Comments (Sub-notes & Discussion)
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

create index idx_org_members_user_id on public.org_members(user_id);
create index idx_org_members_org_id on public.org_members(org_id);
create index idx_teams_org_id on public.teams(org_id);
create index idx_teams_join_code on public.teams(join_code);
create index idx_team_members_user_id on public.team_members(user_id);
create index idx_team_members_team_id on public.team_members(team_id);
create index idx_shifts_team_id on public.shifts(team_id);
create index idx_shifts_user_id on public.shifts(user_id);
create index idx_shifts_status on public.shifts(status);
create index idx_handovers_shift_id on public.handovers(shift_id);
create index idx_tasks_team_id on public.tasks(team_id);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_assigned_to on public.tasks(assigned_to);
create index idx_task_comments_task_id on public.task_comments(task_id);

-- ============================================================
-- 4. SECURITY DEFINER HELPER FUNCTIONS (Prevents RLS Recursion)
-- ============================================================

create or replace function public.is_org_member(org_uuid uuid, user_uuid uuid)
returns boolean
security definer
stable
language plpgsql
as $$
begin
  return exists (
    select 1 from public.org_members
    where org_members.org_id = org_uuid
      and org_members.user_id = user_uuid
  );
end;
$$;

create or replace function public.is_org_admin(org_uuid uuid, user_uuid uuid)
returns boolean
security definer
stable
language plpgsql
as $$
begin
  return exists (
    select 1 from public.org_members
    where org_members.org_id = org_uuid
      and org_members.user_id = user_uuid
      and org_members.role in ('owner', 'admin')
  );
end;
$$;

create or replace function public.is_team_member(team_uuid uuid, user_uuid uuid)
returns boolean
security definer
stable
language plpgsql
as $$
begin
  return exists (
    select 1 from public.team_members
    where team_members.team_id = team_uuid
      and team_members.user_id = user_uuid
  );
end;
$$;

create or replace function public.is_team_admin(team_uuid uuid, user_uuid uuid)
returns boolean
security definer
stable
language plpgsql
as $$
begin
  return exists (
    select 1 from public.team_members
    where team_members.team_id = team_uuid
      and team_members.user_id = user_uuid
      and team_members.role = 'admin'
  );
end;
$$;

create or replace function public.is_shift_team_member(shift_uuid uuid, user_uuid uuid)
returns boolean
security definer
stable
language plpgsql
as $$
declare
  t_id uuid;
begin
  select team_id into t_id from public.shifts where id = shift_uuid;
  if t_id is null then
    return false;
  end if;
  return public.is_team_member(t_id, user_uuid);
end;
$$;

create or replace function public.is_task_team_member(task_uuid uuid, user_uuid uuid)
returns boolean
security definer
stable
language plpgsql
as $$
declare
  t_id uuid;
begin
  select team_id into t_id from public.tasks where id = task_uuid;
  if t_id is null then
    return false;
  end if;
  return public.is_team_member(t_id, user_uuid);
end;
$$;

-- ============================================================
-- 5. TRIGGER FOR USER PROFILES
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
security definer
language plpgsql
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing users (if any)
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.shift_schedules enable row level security;
alter table public.shifts enable row level security;
alter table public.handovers enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- PROFILES
create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

-- ORGANIZATIONS
create policy "org_insert" on public.organizations
  for insert with check (auth.uid() is not null and created_by = auth.uid());

create policy "org_select" on public.organizations
  for select using (
    created_by = auth.uid()
    or public.is_org_member(id, auth.uid())
  );

create policy "org_update" on public.organizations
  for update using (
    created_by = auth.uid()
    or public.is_org_admin(id, auth.uid())
  );

-- ORG_MEMBERS
create policy "org_members_insert" on public.org_members
  for insert with check (
    user_id = auth.uid()
    or public.is_org_admin(org_id, auth.uid())
  );

create policy "org_members_select" on public.org_members
  for select using (
    user_id = auth.uid()
    or public.is_org_member(org_id, auth.uid())
  );

create policy "org_members_delete" on public.org_members
  for delete using (
    user_id = auth.uid()
    or public.is_org_admin(org_id, auth.uid())
  );

-- TEAMS
create policy "teams_insert" on public.teams
  for insert with check (
    public.is_org_member(org_id, auth.uid())
  );

create policy "teams_select" on public.teams
  for select using (
    public.is_org_member(org_id, auth.uid())
    or public.is_team_member(id, auth.uid())
    or join_code is not null
  );

create policy "teams_update" on public.teams
  for update using (
    public.is_team_admin(id, auth.uid())
  );

-- TEAM_MEMBERS
create policy "tm_insert" on public.team_members
  for insert with check (
    user_id = auth.uid()
    or public.is_team_admin(team_id, auth.uid())
  );

create policy "tm_select" on public.team_members
  for select using (
    user_id = auth.uid()
    or public.is_team_member(team_id, auth.uid())
  );

create policy "tm_delete" on public.team_members
  for delete using (
    user_id = auth.uid()
    or public.is_team_admin(team_id, auth.uid())
  );

-- TEAM_INVITES
create policy "ti_manage" on public.team_invites
  for all using (
    public.is_team_admin(team_id, auth.uid())
  );

create policy "ti_read" on public.team_invites
  for select using (true);

create policy "ti_update_accept" on public.team_invites
  for update using (
    email = auth.jwt()->>'email'
  ) with check (
    email = auth.jwt()->>'email'
  );

-- SHIFT_SCHEDULES
create policy "ss_select" on public.shift_schedules
  for select using (
    public.is_team_member(team_id, auth.uid())
  );

create policy "ss_manage" on public.shift_schedules
  for all using (
    public.is_team_admin(team_id, auth.uid())
  );

-- SHIFTS
create policy "shifts_select" on public.shifts
  for select using (
    public.is_team_member(team_id, auth.uid())
  );

create policy "shifts_manage" on public.shifts
  for all using (
    public.is_team_admin(team_id, auth.uid())
  );

create policy "shifts_update_own" on public.shifts
  for update using (
    user_id = auth.uid()
  );

-- HANDOVERS
create policy "handovers_select" on public.handovers
  for select using (
    public.is_shift_team_member(shift_id, auth.uid())
  );

create policy "handovers_insert" on public.handovers
  for insert with check (
    public.is_shift_team_member(shift_id, auth.uid())
  );

create policy "handovers_update" on public.handovers
  for update using (
    public.is_shift_team_member(shift_id, auth.uid())
  );

-- TASKS
create policy "tasks_select" on public.tasks
  for select using (
    public.is_team_member(team_id, auth.uid())
  );

create policy "tasks_insert" on public.tasks
  for insert with check (
    public.is_team_member(team_id, auth.uid())
  );

create policy "tasks_update" on public.tasks
  for update using (
    public.is_team_member(team_id, auth.uid())
  );

create policy "tasks_delete" on public.tasks
  for delete using (
    public.is_team_member(team_id, auth.uid())
  );

-- TASK_COMMENTS
create policy "task_comments_select" on public.task_comments
  for select using (
    public.is_task_team_member(task_id, auth.uid())
  );

create policy "task_comments_insert" on public.task_comments
  for insert with check (
    public.is_task_team_member(task_id, auth.uid())
  );
