"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function TeamSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [joinCode, setJoinCode] = useState("");
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
      setTeamName(teamData.name);
      setJoinCode(teamData.join_code || "");
      setLoading(false);
    };

    loadData();
  }, [orgId, teamId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setSaving(true);

    const { error } = await supabase
      .from("teams")
      .update({ name: teamName.trim() })
      .eq("id", teamId);

    if (error) {
      alert("Failed to update team.");
    } else {
      setTeam({ ...team, name: teamName.trim() });
    }

    setSaving(false);
  };

  const handleRegenerateCode = async () => {
    if (!confirm("Generate a new join code? The old code will stop working.")) return;

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase
      .from("teams")
      .update({ join_code: newCode })
      .eq("id", teamId);

    if (error) {
      alert("Failed to generate new code.");
    } else {
      setJoinCode(newCode);
      setTeam({ ...team, join_code: newCode });
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
          <span className="text-slate-600">{team?.name} / Settings</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Team Settings</h1>
          <Link
            href={`/org/${orgId}/team/${teamId}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Team
          </Link>
        </div>

        {/* General */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">General</h2>
          <form onSubmit={handleSave}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
            />
            <button
              type="submit"
              disabled={saving || teamName === team?.name}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Join Code */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Join Code</h2>
          <p className="text-sm text-slate-600 mb-4">
            Share this code so workers can join your team.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-mono font-bold text-slate-900 bg-slate-100 px-4 py-2 rounded-lg">
              {joinCode || "No code"}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(joinCode)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Copy
            </button>
          </div>

          <button
            onClick={handleRegenerateCode}
            className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Regenerate Code
          </button>
        </div>
      </main>
    </div>
  );
}
