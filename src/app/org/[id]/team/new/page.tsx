"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function NewTeamPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setCreating(true);
    setError("");

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Guard: verify auth before any insert
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      console.error("No active session found! RLS will block this insert.");
      setError("Not logged in. Please sign in first.");
      setCreating(false);
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: teamName.trim(),
        org_id: orgId,
        created_by: user.id,
        join_code: joinCode,
      })
      .select()
      .single();

    if (teamError || !team) {
      console.error("Error creating team:", teamError);
      setError("Failed to create team. Please try again.");
      setCreating(false);
      return;
    }

    // Add creator as team admin
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: user.id, role: "admin" });

    if (memberError) {
      console.error("Error adding team admin:", memberError);
      setError("Failed to set up team. Please try again.");
      setCreating(false);
      return;
    }

    router.push(`/org/${orgId}/team/${team.id}`);
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
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Create a Team</h1>
          <p className="text-slate-600 mb-6">
            Teams are where shift handovers happen. Create one for your group.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Day Shift Crew"
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-6"
            />

            <button
              type="submit"
              disabled={creating || !teamName.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Team"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
