"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const router = useRouter();

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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setError("");

    // Find team by join code
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("join_code", joinCode.trim().toUpperCase())
      .single();

    if (teamError || !team) {
      setError("Invalid join code. Please check and try again.");
      setJoining(false);
      return;
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", team.id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      setError("You're already a member of this team.");
      setJoining(false);
      return;
    }

    // Join the team
    const { error: joinError } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: user.id, role: "member" });

    if (joinError) {
      console.error("Error joining team:", joinError);
      setError("Failed to join team. Please try again.");
      setJoining(false);
      return;
    }

    // Also add user to the org if team has one (prevents orphaned member lockout)
    if (team.org_id) {
      const { data: existingOrgMember } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", team.org_id)
        .eq("user_id", user.id)
        .single();

      if (!existingOrgMember) {
        await supabase
          .from("org_members")
          .insert({ org_id: team.org_id, user_id: user.id, role: "member" });
      }
    }

    setSuccess(true);
    setJoining(false);

    // Redirect to team after 2 seconds
    setTimeout(() => {
      if (team.org_id) {
        router.push(`/org/${team.org_id}/team/${team.id}`);
      } else {
        router.push("/dashboard");
      }
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to the team!</h1>
          <p className="text-slate-600">Redirecting you to your team now...</p>
        </div>
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
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Join a Team</h1>
          <p className="text-slate-600 mb-6">
            Enter the join code from your team admin.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Join Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-lg text-center tracking-wider mb-6"
            />

            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {joining ? "Joining..." : "Join Team"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
