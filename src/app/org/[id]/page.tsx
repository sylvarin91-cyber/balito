"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  join_code: string | null;
}

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
}

export default function OrgPage() {
  const [user, setUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Load org
      const { data: orgData } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (!orgData) {
        router.push("/org/new");
        return;
      }
      setOrg(orgData);

      // Load teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      setTeams(teamsData || []);

      // Load members count
      const { data: membersData } = await supabase
        .from("org_members")
        .select("*")
        .eq("org_id", orgId);

      setMembers(membersData || []);
      setLoading(false);
    };

    loadData();
  }, [orgId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreatingTeam(true);

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Guard: verify auth before any insert
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      console.error("No active session found! RLS will block this insert.");
      setCreatingTeam(false);
      return;
    }

    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        name: newTeamName.trim(),
        org_id: orgId,
        created_by: user.id,
        join_code: joinCode,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team.");
    } else {
      // Add creator as team admin
      await supabase
        .from("team_members")
        .insert({ team_id: team.id, user_id: user.id, role: "admin" });

      setTeams([...teams, team]);
      setNewTeamName("");
    }

    setCreatingTeam(false);
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={handleSignOut} className="text-sm text-slate-600 hover:text-slate-900">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{org?.name}</h1>
            <p className="text-slate-600">{members.length} members</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/org/${orgId}/members`}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Manage Members
            </Link>
            <Link
              href={`/org/${orgId}/settings`}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>

        {/* Create Team */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Create a Team</h2>
          <form onSubmit={handleCreateTeam} className="flex gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g. Production Line A"
              required
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="submit"
              disabled={creatingTeam || !newTeamName.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {creatingTeam ? "Creating..." : "Create Team"}
            </button>
          </form>
        </div>

        {/* Teams List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Teams</h2>
          {teams.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No teams yet. Create your first team above.
            </p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  href={`/org/${orgId}/team/${team.id}`}
                  className="block border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">{team.name}</h3>
                    {team.join_code && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
                        {team.join_code}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
