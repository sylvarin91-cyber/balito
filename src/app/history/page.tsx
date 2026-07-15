"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Shift {
  id: string;
  team_id: string;
  started_at: string;
  ended_at: string | null;
  status: "active" | "completed";
}

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
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

      // Load all shifts for user's teams
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);

      const teamIds = (teamMembers || []).map((tm) => tm.team_id);

      let shiftsData = null;
      if (teamIds.length > 0) {
        const result = await supabase
          .from("shifts")
          .select("*")
          .in("team_id", teamIds)
          .order("started_at", { ascending: false });
        shiftsData = result.data;
      }

      setShifts(shiftsData || []);
      setLoading(false);
    };

    loadData();
  }, []);

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return "In progress";
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shift History</h1>
          <Link
            href="/shift/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            New Shift
          </Link>
        </div>

        {shifts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500 mb-4">No shifts recorded yet.</p>
            <Link
              href="/shift/new"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Start Your First Shift
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {shifts.map((shift) => (
              <Link
                key={shift.id}
                href={`/shift/${shift.id}`}
                className="block bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm px-3 py-1 rounded-full font-medium ${
                      shift.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {shift.status === "active" ? "Active" : "Completed"}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatDuration(shift.started_at, shift.ended_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Started:</span>
                    <p className="text-slate-900">
                      {new Date(shift.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Ended:</span>
                    <p className="text-slate-900">
                      {shift.ended_at
                        ? new Date(shift.ended_at).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
