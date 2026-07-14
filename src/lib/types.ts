export interface Team {
  id: string
  name: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'member'
  created_at: string
}

export interface Shift {
  id: string
  team_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed'
}

export interface Handover {
  id: string
  shift_id: string
  content: string
  priority: 'urgent' | 'normal' | 'resolved'
  created_at: string
}

export interface User {
  id: string
  email: string
}
