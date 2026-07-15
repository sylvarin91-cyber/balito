export interface Organization {
  id: string
  name: string
  parent_id: string | null
  created_by: string | null
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

export interface Team {
  id: string
  name: string
  org_id: string | null
  created_by: string | null
  join_code: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'member'
  created_at: string
}

export interface TeamInvite {
  id: string
  team_id: string
  email: string
  invited_by: string | null
  code: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface ShiftSchedule {
  id: string
  team_id: string
  shift_name: string
  start_hour: number
  start_minute: number
  end_hour: number
  end_minute: number
  days_of_week: number[]
  created_by: string | null
  created_at: string
}

export interface Shift {
  id: string
  team_id: string
  user_id: string | null
  schedule_id: string | null
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed' | 'scheduled'
  shift_date: string | null
  shift_name: string | null
}

export interface Handover {
  id: string
  shift_id: string
  content: string
  priority: 'urgent' | 'normal' | 'resolved'
  created_by: string | null
  created_at: string
}

export interface User {
  id: string
  email: string
}
