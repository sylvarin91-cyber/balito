"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
}

interface Shift {
  id: string;
  user_id: string | null;
  shift_name: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export default function TeamPage() {
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const teamId = params.teamId as string;

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Load team
      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (!teamData) {
        router.push(`/org/${orgId}`);
        return;
      }
      setTeam(teamData);

      // Load members
      const { data: membersData } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId);

      setMembers(membersData || []);

      // Load active shifts
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "active");

      setActiveShifts(shiftsData || []);
      setLoading(false);
    };

    loadData();
  }, [orgId, teamId]);

  const handleStartShift = async () => {
    const { data: shift, error } = await supabase
      .from("shifts")
      .insert({
        team_id: teamId,
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/org/${orgId}`} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="text-xl font-bold text-slate-900">Balito</span>
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600">{team?.name}</span>
          </div>
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
            <h1 className="text-2xl font-bold text-slate-900">{team?.name}</h1>
            <p className="text-slate-600">{members.length} members</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/org/${orgId}/team/${teamId}/members`}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Members
            </Link>
            <Link
              href={`/org/${orgId}/team/${teamId}/settings`}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Settings
            </Link>
            <Link
              href={`/org/${orgId}/team/${teamId}/schedule`}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Schedule
            </Link>
            <button
              onClick={handleStartShift}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Start Shift
            </button>
          </div>
        </div>

        {/* Active Shifts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Shifts</h2>
          {activeShifts.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No active shifts right now.
            </p>
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
                        Started {new Date(shift.started_at).toLocaleString()}
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

        {/* Team Members */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Team Members</h2>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border border-slate-200 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{member.user_id}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    member.role === "admin"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
