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

interface Handover {
  id: string;
  shift_id: string;
  content: string;
  priority: "urgent" | "normal" | "resolved";
  created_at: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [recentHandovers, setRecentHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Get active shift
      const { data: shift } = await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      setActiveShift(shift);

      // Get recent handovers
      if (shift) {
        const { data: handovers } = await supabase
          .from("handovers")
          .select("*")
          .eq("shift_id", shift.id)
          .order("created_at", { ascending: false });

        setRecentHandovers(handovers || []);
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

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
      {/* Header */}
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
            <button
              onClick={handleSignOut}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Current Status</h2>
            {activeShift ? (
              <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full font-medium">
                On Shift
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 text-sm px-3 py-1 rounded-full font-medium">
                Off Shift
              </span>
            )}
          </div>

          {activeShift ? (
            <div>
              <p className="text-slate-600 mb-4">
                Shift started: {new Date(activeShift.started_at).toLocaleString()}
              </p>
              <Link
                href={`/shift/${activeShift.id}`}
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                View Shift Details
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-slate-600 mb-4">You&apos;re not currently on shift.</p>
              <Link
                href="/shift/new"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Start New Shift
              </Link>
            </div>
          )}
        </div>

        {/* Recent Handovers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Handovers</h2>

          {recentHandovers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No handovers yet. Start a shift to add your first note.
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
