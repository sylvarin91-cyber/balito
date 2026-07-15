"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewShiftPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  const handleStartShift = async () => {
    setCreating(true);

    // Check if user has a team, if not create one
    const { data: memberRows } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1);

    let teamId: string;

    if (memberRows && memberRows.length > 0) {
      teamId = memberRows[0].team_id;
    } else {
      // Create a new team
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({ name: `${user.email}'s Team` })
        .select()
        .single();

      if (teamError || !team) {
        console.error("Error creating team:", teamError);
        alert("Failed to create team. Please try again.");
        setCreating(false);
        return;
      }

      // Add user as admin
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({ team_id: team.id, user_id: user.id, role: "admin" });

      if (memberError) {
        console.error("Error adding team member:", memberError);
        alert("Failed to create team. Please try again.");
        setCreating(false);
        return;
      }

      teamId = team.id;
    }

    const { data, error } = await supabase
      .from("shifts")
      .insert({
        team_id: teamId,
        user_id: user.id,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating shift:", error);
      alert("Failed to create shift. Please try again.");
      setCreating(false);
      return;
    }

    router.push(`/shift/${data.id}`);
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
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Start New Shift</h1>
          <p className="text-slate-600 mb-6">
            Begin tracking your shift. You can add handover notes and flag issues as you go.
          </p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-slate-600">
              <p><strong>When you start:</strong></p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Shift timer begins</li>
                <li>You can add handover notes</li>
                <li>You can flag urgent issues</li>
                <li>Everything is saved automatically</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              href="/dashboard"
              className="flex-1 text-center border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleStartShift}
              disabled={creating}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {creating ? "Starting..." : "Start Shift"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
