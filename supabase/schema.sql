-- Balito - Full Database Reset
-- Run this in Supabase SQL Editor. Drops everything and recreates.

-- DROP ALL POLICIES
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
  END LOOP;
END $$;

-- DROP ALL TABLES
DROP TABLE IF EXISTS handovers CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS shift_schedules CASCADE;
DROP TABLE IF EXISTS team_invites CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS org_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- CREATE TABLES

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  join_code text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  shift_name text NOT NULL,
  start_hour int NOT NULL CHECK (start_hour >= 0 AND start_hour < 24),
  start_minute int NOT NULL DEFAULT 0 CHECK (start_minute >= 0 AND start_minute < 60),
  end_hour int NOT NULL CHECK (end_hour >= 0 AND end_hour < 24),
  end_minute int NOT NULL DEFAULT 0 CHECK (end_minute >= 0 AND end_minute < 60),
  days_of_week int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES shift_schedules(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'scheduled')),
  shift_date date,
  shift_name text
);

CREATE TABLE handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE,
  content text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'resolved')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- INDEXES

CREATE INDEX idx_organizations_parent_id ON organizations(parent_id);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_teams_org_id ON teams(org_id);
CREATE INDEX idx_teams_join_code ON teams(join_code);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_shifts_team_id ON shifts(team_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_shift_date ON shifts(shift_date);
CREATE INDEX idx_handovers_shift_id ON handovers(shift_id);

-- ENABLE RLS

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;

-- POLICIES: Organizations

CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (
    id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- POLICIES: Org members

CREATE POLICY "org_members_select" ON org_members
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_members_insert" ON org_members
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "org_members_delete" ON org_members
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- POLICIES: Teams

CREATE POLICY "teams_select" ON teams
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    OR id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "teams_insert" ON teams
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "teams_update" ON teams
  FOR UPDATE USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- POLICIES: Team members

CREATE POLICY "tm_select" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  );

CREATE POLICY "tm_insert" ON team_members
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
    OR team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  );

CREATE POLICY "tm_delete" ON team_members
  FOR DELETE USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
    OR team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  );

-- POLICIES: Team invites

CREATE POLICY "ti_manage" ON team_invites
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
    OR team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  );

CREATE POLICY "ti_read" ON team_invites
  FOR SELECT USING (true);

-- POLICIES: Shift schedules

CREATE POLICY "ss_select" ON shift_schedules
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ss_manage" ON shift_schedules
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- POLICIES: Shifts

CREATE POLICY "shifts_select" ON shifts
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "shifts_manage" ON shifts
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "shifts_update_own" ON shifts
  FOR UPDATE USING (user_id = auth.uid());

-- POLICIES: Handovers

CREATE POLICY "handovers_select" ON handovers
  FOR SELECT USING (
    shift_id IN (SELECT id FROM shifts WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "handovers_insert" ON handovers
  FOR INSERT WITH CHECK (
    shift_id IN (SELECT id FROM shifts WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "handovers_update" ON handovers
  FOR UPDATE USING (
    shift_id IN (SELECT id FROM shifts WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  );
