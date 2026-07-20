"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Shift {
  id: string;
  team_id: string;
  user_id: string | null;
  shift_name: string | null;
  shift_date: string | null;
  schedule_id: string | null;
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

export default function ShiftPage() {
  const [user, setUser] = useState<any>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "urgent">("normal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const shiftId = params.id as string;

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Load shift
      const { data: shiftData } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shiftId)
        .single();

      if (!shiftData) {
        router.push("/dashboard");
        return;
      }

      setShift(shiftData);

      // Load handovers
      const { data: handoversData } = await supabase
        .from("handovers")
        .select("*")
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: false });

      setHandovers(handoversData || []);
      setLoading(false);
    };

    loadData();
  }, [shiftId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSaving(true);

    // Guard: verify auth before any insert
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      console.error("No active session found! RLS will block this insert.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("handovers").insert({
      shift_id: shiftId,
      content: newNote.trim(),
      priority: newPriority,
    });

    if (error) {
      console.error("Error adding note:", error);
      alert("Failed to add note. Please try again.");
    } else {
      // Reload handovers
      const { data } = await supabase
        .from("handovers")
        .select("*")
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: false });

      setHandovers(data || []);
      setNewNote("");
      setNewPriority("normal");
    }

    setSaving(false);
  };

  const handleEndShift = async () => {
    if (!confirm("Are you sure you want to end this shift?")) return;

    const { error } = await supabase
      .from("shifts")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", shiftId);

    if (error) {
      console.error("Error ending shift:", error);
      alert("Failed to end shift. Please try again.");
    } else {
      router.push("/dashboard");
    }
  };

  const handleConvertToTask = async (handover: Handover) => {
    if (!shift?.team_id) return;
    const taskPriority = handover.priority === "urgent" ? "urgent" : "normal";

    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert({
        team_id: shift.team_id,
        title: handover.content.slice(0, 80) + (handover.content.length > 80 ? "..." : ""),
        description: `Created from shift handover note:\n"${handover.content}"\nShift: ${shift.shift_name || "Active Shift"}`,
        status: "todo",
        priority: taskPriority,
        target_shift_name: shift.shift_name || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      alert(`Failed to create task: ${error.message}`);
    } else {
      alert("Note successfully converted into a Kanban Task on the team board!");
    }
  };

  const handleMarkResolved = async (handoverId: string) => {
    const { error } = await supabase
      .from("handovers")
      .update({ priority: "resolved" })
      .eq("id", handoverId);

    if (error) {
      console.error("Error marking resolved:", error);
    } else {
      setHandovers(
        handovers.map((h) =>
          h.id === handoverId ? { ...h, priority: "resolved" as const } : h
        )
      );
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
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
          {shift?.status === "active" && (
            <button
              onClick={handleEndShift}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              End Shift
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Shift Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Shift Details</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full font-medium ${
                shift?.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {shift?.status === "active" ? "Active" : "Completed"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Worker:</span>
              <p className="text-slate-900">{shift?.user_id}</p>
            </div>
            <div>
              <span className="text-slate-500">Shift Name:</span>
              <p className="text-slate-900">{shift?.shift_name || "-"}</p>
            </div>
            <div>
              <span className="text-slate-500">Started:</span>
              <p className="text-slate-900">
                {shift ? new Date(shift.started_at).toLocaleString() : "-"}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Ended:</span>
              <p className="text-slate-900">
                {shift?.ended_at
                  ? new Date(shift.ended_at).toLocaleString()
                  : "In progress"}
              </p>
            </div>
          </div>
        </div>

        {/* Add Note Form */}
        {shift?.status === "active" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Handover Note</h2>

            <form onSubmit={handleAddNote}>
              <div className="mb-4">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="What should the next shift know?"
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="normal"
                      checked={newPriority === "normal"}
                      onChange={() => setNewPriority("normal")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Normal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={newPriority === "urgent"}
                      onChange={() => setNewPriority("urgent")}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="text-sm text-slate-700">Urgent</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving || !newNote.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Note"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Handover Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Handover Notes</h2>

          {handovers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No notes yet. Add your first handover note above.
            </p>
          ) : (
            <div className="space-y-3">
              {handovers.map((handover) => (
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConvertToTask(handover)}
                        title="Convert to Ops Kanban Task"
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-medium transition-colors border border-slate-200 flex items-center gap-1"
                      >
                        <span>📋 Convert to Task</span>
                      </button>
                      {handover.priority === "urgent" && shift?.status === "active" && (
                        <button
                          onClick={() => handleMarkResolved(handover.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1"
                        >
                          Mark Resolved
                        </button>
                      )}
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
