"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NUMBERS = [0, 1, 2, 3, 4, 5, 6];

interface ShiftSchedule {
  id: string;
  shift_name: string;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  days_of_week: number[];
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
}

interface ScheduledShift {
  id: string;
  schedule_id: string;
  user_id: string | null;
  shift_date: string;
  shift_name: string;
  status: string;
}

export default function SchedulePage() {
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const teamId = params.teamId as string;

  const getWeekDates = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date.toISOString().split("T")[0];
    });
  };

  const weekDates = getWeekDates();

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

      // Load schedules
      const { data: schedulesData } = await supabase
        .from("shift_schedules")
        .select("*")
        .eq("team_id", teamId);

      setSchedules(schedulesData || []);

      // Load members
      const { data: membersData } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId);

      setMembers(membersData || []);

      // Load scheduled shifts for current week
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "scheduled")
        .gte("shift_date", weekDates[0])
        .lte("shift_date", weekDates[6]);

      setScheduledShifts(shiftsData || []);
      setLoading(false);
    };

    loadData();
  }, [orgId, teamId, weekOffset]);

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    const m = minute.toString().padStart(2, "0");
    return `${h}:${m}${ampm}`;
  };

  const handleAssign = async (scheduleId: string, date: string) => {
    if (!selectedMember) {
      setAssigning(`${scheduleId}-${date}`);
      return;
    }

    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    const { error } = await supabase.from("shifts").insert({
      team_id: teamId,
      user_id: selectedMember,
      schedule_id: scheduleId,
      shift_date: date,
      shift_name: schedule.shift_name,
      status: "scheduled",
      started_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error assigning shift:", error);
      alert("Failed to assign shift.");
    } else {
      // Reload shifts
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "scheduled")
        .gte("shift_date", weekDates[0])
        .lte("shift_date", weekDates[6]);

      setScheduledShifts(data || []);
      setAssigning(null);
      setSelectedMember("");
    }
  };

  const getShiftForSlot = (scheduleId: string, date: string) => {
    return scheduledShifts.find(
      (s) => s.schedule_id === scheduleId && s.shift_date === date
    );
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm("Remove this shift assignment?")) return;

    const { error } = await supabase
      .from("shifts")
      .delete()
      .eq("id", shiftId);

    if (!error) {
      setScheduledShifts(scheduledShifts.filter((s) => s.id !== shiftId));
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
          <span className="text-slate-600">{team?.name} / Schedule</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shift Schedule</h1>
          <div className="flex gap-3">
            <Link
              href={`/org/${orgId}/team/${teamId}/schedule/new`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              + New Template
            </Link>
            <Link
              href={`/org/${orgId}/team/${teamId}`}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to Team
            </Link>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            &larr; Previous Week
          </button>
          <span className="text-slate-900 font-medium">
            {weekDates[0]} — {weekDates[6]}
          </span>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            Next Week &rarr;
          </button>
        </div>

        {/* Member Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <label className="text-sm font-medium text-slate-700 mr-3">
            Assign to:
          </label>
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Select a team member...</option>
            {members.map((m) => (
              <option key={m.id} value={m.user_id}>
                {m.user_id}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 ml-3">
            Then click a cell below to assign
          </span>
        </div>

        {schedules.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500 mb-4">No shift templates yet.</p>
            <Link
              href={`/org/${orgId}/team/${teamId}/schedule/new`}
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Your First Template
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Schedule Grid */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 bg-slate-50">
                      Shift
                    </th>
                    {weekDates.map((date, i) => (
                      <th
                        key={date}
                        className="px-4 py-3 text-center text-sm font-medium text-slate-700 bg-slate-50"
                      >
                        <div>{DAYS[DAY_NUMBERS[new Date(date).getDay()]]}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{schedule.shift_name}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(schedule.start_hour, schedule.start_minute)} —{" "}
                          {formatTime(schedule.end_hour, schedule.end_minute)}
                        </p>
                      </td>
                      {weekDates.map((date) => {
                        const shift = getShiftForSlot(schedule.id, date);
                        const isAssignedDay = schedule.days_of_week.includes(
                          new Date(date).getDay()
                        );

                        return (
                          <td key={date} className="px-2 py-2">
                            {shift ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                                <p className="text-xs font-medium text-green-800 truncate">
                                  {shift.user_id}
                                </p>
                                <button
                                  onClick={() => handleDeleteShift(shift.id)}
                                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : isAssignedDay ? (
                              <button
                                onClick={() => handleAssign(schedule.id, date)}
                                className="w-full h-full min-h-[48px] border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                              >
                                Assign
                              </button>
                            ) : (
                              <div className="w-full h-full min-h-[48px] bg-slate-50 rounded-lg" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
