"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function NewSchedulePage() {
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shiftName, setShiftName] = useState("");
  const [startHour, setStartHour] = useState(6);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(14);
  const [endMinute, setEndMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
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
      setLoading(false);
    };

    loadData();
  }, [orgId, teamId]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    const m = minute.toString().padStart(2, "0");
    return `${h}:${m} ${ampm}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim() || selectedDays.length === 0) return;

    setSaving(true);

    const { error } = await supabase.from("shift_schedules").insert({
      team_id: teamId,
      shift_name: shiftName.trim(),
      start_hour: startHour,
      start_minute: startMinute,
      end_hour: endHour,
      end_minute: endMinute,
      days_of_week: selectedDays,
      created_by: user.id,
    });

    if (error) {
      console.error("Error creating schedule:", error);
      alert("Failed to create schedule.");
    } else {
      router.push(`/org/${orgId}/team/${teamId}/schedule`);
    }

    setSaving(false);
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
          <span className="text-slate-600">{team?.name} / New Shift Template</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Shift Template</h1>
          <p className="text-slate-600 mb-6">
            Define a shift that repeats on selected days.
          </p>

          <form onSubmit={handleCreate}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Shift Name
            </label>
            <input
              type="text"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              placeholder="e.g. Day Shift"
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
            />

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Start Time
                </label>
                <select
                  value={`${startHour}:${startMinute}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    setStartHour(h);
                    setStartMinute(m);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = Math.floor(i / 2);
                    const m = i % 2 === 0 ? 0 : 30;
                    return (
                      <option key={i} value={`${h}:${m}`}>
                        {formatTime(h, m)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  End Time
                </label>
                <select
                  value={`${endHour}:${endMinute}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    setEndHour(h);
                    setEndMinute(m);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = Math.floor(i / 2);
                    const m = i % 2 === 0 ? 0 : 30;
                    return (
                      <option key={i} value={`${h}:${m}`}>
                        {formatTime(h, m)}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-2">
              Days of Week
            </label>
            <div className="flex gap-2 mb-6">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                    selectedDays.includes(i)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-600">
                <strong>Preview:</strong> {shiftName || "Shift"} —{" "}
                {formatTime(startHour, startMinute)} to {formatTime(endHour, endMinute)} on{" "}
                {selectedDays.length === 7
                  ? "every day"
                  : selectedDays.length === 0
                  ? "no days"
                  : selectedDays.map((d) => DAYS[d]).join(", ")}
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !shiftName.trim() || selectedDays.length === 0}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Shift Template"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
