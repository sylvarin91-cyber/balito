"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export default function TeamMembersPage() {
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ code: string; expires: string } | null>(null);
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

      const { data: membersData } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

      setMembers(membersData || []);
      setLoading(false);
    };

    loadData();
  }, [orgId, teamId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteResult(null);

    const code = Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("team_invites").insert({
      team_id: teamId,
      email: inviteEmail.trim(),
      invited_by: user.id,
      code,
      expires_at: expiresAt,
    });

    if (error) {
      alert("Failed to create invite.");
    } else {
      setInviteResult({ code, expires: new Date(expiresAt).toLocaleDateString() });
      setInviteEmail("");
    }

    setInviting(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the team?")) return;

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      alert("Failed to remove member.");
    } else {
      setMembers(members.filter((m) => m.id !== memberId));
    }
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
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Link href={`/org/${orgId}/team/${teamId}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600">{team?.name} / Members</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
          <Link
            href={`/org/${orgId}/team/${teamId}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Team
          </Link>
        </div>

        {/* Invite by Email */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Invite by Email</h2>
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="submit"
              disabled={inviting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {inviting ? "Creating..." : "Send Invite"}
            </button>
          </form>

          {inviteResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium mb-1">Invite created!</p>
              <p className="text-sm text-green-700">
                Share this code with your colleague:{" "}
                <span className="font-mono font-bold">{inviteResult.code}</span>
              </p>
              <p className="text-xs text-green-600 mt-1">
                Expires: {inviteResult.expires}
              </p>
            </div>
          )}

          <p className="text-sm text-slate-500 mt-3">
            The invited person can join at{" "}
            <Link href="/join" className="text-blue-600 hover:text-blue-700">
              balito.xyz/join
            </Link>{" "}
            using the code above.
          </p>
        </div>

        {/* Join Code */}
        {team?.join_code && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Team Join Code</h2>
            <p className="text-sm text-slate-600 mb-3">
              Share this code so people can join your team directly.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-mono font-bold text-slate-900 bg-slate-100 px-4 py-2 rounded-lg">
                {team.join_code}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(team.join_code)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Current Members ({members.length})
          </h2>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border border-slate-200 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{member.user_id}</p>
                  <p className="text-xs text-slate-500">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      member.role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {member.role}
                  </span>
                  {member.user_id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
