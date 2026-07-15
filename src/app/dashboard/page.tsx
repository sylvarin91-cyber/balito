"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Org {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  org_id: string;
}

interface Shift {
  id: string;
  team_id: string;
  user_id: string | null;
  shift_name: string | null;
  shift_date: string | null;
  started_at: string;
  ended_at: string | null;
  status: "active" | "completed" | "scheduled";
}

interface Handover {
  id: string;
  shift_id: string;
  content: string;
  priority: "urgent" | "normal" | "resolved";
  created_at: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<Shift[]>([]);
  const [recentHandovers, setRecentHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Load user's organizations
      const { data: orgMembers } = await supabase
        .from("org_members")
        .select("org_id, organizations(*)")
        .eq("user_id", user.id);

      if (!orgMembers || orgMembers.length === 0) {
        router.push("/org/new");
        return;
      }

      const userOrgs = orgMembers.map((m: any) => m.organizations).filter(Boolean);
      setOrgs(userOrgs);

      if (userOrgs.length > 0) {
        setSelectedOrg(userOrgs[0]);
        await loadTeams(userOrgs[0].id);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const loadTeams = async (orgId: string) => {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")
      .eq("org_id", orgId);

    setTeams(teamsData || []);

    if (teamsData && teamsData.length > 0) {
      setSelectedTeam(teamsData[0]);
      await loadTeamData(teamsData[0].id);
    } else {
      setSelectedTeam(null);
      setActiveShifts([]);
      setScheduledShifts([]);
      setRecentHandovers([]);
    }
  };

  const loadTeamData = async (teamId: string) => {
    // Load active shifts
    const { data: activeData } = await supabase
      .from("shifts")
      .select("*")
      .eq("team_id", teamId)
      .eq("status", "active");

    setActiveShifts(activeData || []);

    // Load scheduled shifts (upcoming)
    const today = new Date().toISOString().split("T")[0];
    const { data: scheduledData } = await supabase
      .from("shifts")
      .select("*")
      .eq("team_id", teamId)
      .eq("status", "scheduled")
      .gte("shift_date", today)
      .order("shift_date", { ascending: true })
      .limit(10);

    setScheduledShifts(scheduledData || []);

    // Load recent handovers from active shifts
    if (activeData && activeData.length > 0) {
      const shiftIds = activeData.map((s) => s.id);
      const { data: handoversData } = await supabase
        .from("handovers")
        .select("*")
        .in("shift_id", shiftIds)
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentHandovers(handoversData || []);
    } else {
      setRecentHandovers([]);
    }
  };

  const handleOrgChange = async (orgId: string) => {
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      setSelectedOrg(org);
      await loadTeams(org.id);
    }
  };

  const handleTeamChange = async (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      setSelectedTeam(team);
      await loadTeamData(team.id);
    }
  };

  const handleStartShift = async () => {
    if (!selectedTeam) return;

    const { data: shift, error } = await supabase
      .from("shifts")
      .insert({
        team_id: selectedTeam.id,
        user_id: user.id,
        status: "active",
        shift_name: "Quick Shift",
      })
      .select()
      .single();

    if (!error && shift) {
      router.push(`/shift/${shift.id}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/join" className="text-sm text-slate-600 hover:text-slate-900">
              Join Team
            </Link>
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={handleSignOut} className="text-sm text-slate-600 hover:text-slate-900">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Org & Team Selector */}
        <div className="flex items-center gap-4 mb-8">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Organization</label>
            <select
              value={selectedOrg?.id || ""}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Team</label>
            <select
              value={selectedTeam?.id || ""}
              onChange={(e) => handleTeamChange(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          {selectedOrg && (
            <Link
              href={`/org/${selectedOrg.id}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-5"
            >
              Manage Org
            </Link>
          )}
          {selectedTeam && (
            <Link
              href={`/org/${selectedOrg?.id}/team/${selectedTeam.id}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-5"
            >
              Team Details
            </Link>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={handleStartShift}
            className="bg-blue-600 text-white p-4 rounded-xl font-medium hover:bg-blue-700 transition-colors text-left"
          >
            <div className="text-lg">Start Shift</div>
            <div className="text-sm text-blue-200">Begin tracking now</div>
          </button>
          <Link
            href={`/org/${selectedOrg?.id}/team/${selectedTeam?.id}/schedule`}
            className="bg-white border border-slate-200 p-4 rounded-xl font-medium hover:border-blue-300 transition-colors text-left"
          >
            <div className="text-lg text-slate-900">View Schedule</div>
            <div className="text-sm text-slate-500">Weekly shift calendar</div>
          </Link>
          <Link
            href={`/org/${selectedOrg?.id}/team/${selectedTeam?.id}/members`}
            className="bg-white border border-slate-200 p-4 rounded-xl font-medium hover:border-blue-300 transition-colors text-left"
          >
            <div className="text-lg text-slate-900">Team Members</div>
            <div className="text-sm text-slate-500">Invite & manage</div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Shifts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Shifts</h2>
            {activeShifts.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No active shifts right now.</p>
            ) : (
              <div className="space-y-3">
                {activeShifts.map((shift) => (
                  <Link
                    key={shift.id}
                    href={`/shift/${shift.id}`}
                    className="block border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {shift.shift_name || "Shift"}
                        </p>
                        <p className="text-sm text-slate-500">
                          Worker: {shift.user_id}
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">
                        Active
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Scheduled Shifts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Shifts</h2>
            {scheduledShifts.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No scheduled shifts.</p>
            ) : (
              <div className="space-y-3">
                {scheduledShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {shift.shift_name || "Shift"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {shift.shift_date} — {shift.user_id}
                        </p>
                      </div>
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
                        Scheduled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Handovers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Handovers</h2>
          {recentHandovers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No handovers yet. Start a shift to add notes.
            </p>
          ) : (
            <div className="space-y-3">
              {recentHandovers.map((handover) => (
                <div
                  key={handover.id}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        handover.priority === "urgent"
                          ? "bg-orange-100 text-orange-700"
                          : handover.priority === "resolved"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {handover.priority.charAt(0).toUpperCase() + handover.priority.slice(1)}
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-700">{handover.content}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(handover.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
