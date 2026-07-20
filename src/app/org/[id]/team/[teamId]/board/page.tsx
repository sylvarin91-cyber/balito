"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Task {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "handover_pending" | "completed";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to: string | null;
  target_shift_date: string | null;
  target_shift_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee_email?: string;
}

interface TeamMember {
  user_id: string;
  email: string;
}

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string;
}

const COLUMNS: { id: Task["status"]; label: string; color: string; badgeBg: string }[] = [
  { id: "backlog", label: "Backlog", color: "border-slate-300 bg-slate-50/70", badgeBg: "bg-slate-200 text-slate-700" },
  { id: "todo", label: "To Do", color: "border-blue-200 bg-blue-50/40", badgeBg: "bg-blue-100 text-blue-800" },
  { id: "in_progress", label: "In Progress", color: "border-amber-200 bg-amber-50/40", badgeBg: "bg-amber-100 text-amber-800" },
  { id: "handover_pending", label: "Handover Pending", color: "border-purple-200 bg-purple-50/40", badgeBg: "bg-purple-100 text-purple-800" },
  { id: "completed", label: "Completed", color: "border-emerald-200 bg-emerald-50/40", badgeBg: "bg-emerald-100 text-emerald-800" },
];

export default function KanbanBoardPage() {
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // New Task Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<Task["status"]>("todo");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("normal");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newShiftName, setNewShiftName] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Selected Task Modal (Details & Comments)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const teamId = params.teamId as string;

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUser(user);

    // Fetch team details
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

    // Fetch team members with emails
    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId);

    if (teamMembersData && teamMembersData.length > 0) {
      const uIds = teamMembersData.map((m) => m.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", uIds);

      setMembers(
        profilesData?.map((p) => ({ user_id: p.id, email: p.email })) || []
      );
    }

    // Fetch tasks
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (tasksData) {
      const allUserIds = Array.from(
        new Set(tasksData.map((t) => t.assigned_to).filter(Boolean) as string[])
      );
      let emailMap = new Map<string, string>();
      if (allUserIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", allUserIds);
        profs?.forEach((p) => emailMap.set(p.id, p.email));
      }

      setTasks(
        tasksData.map((t) => ({
          ...t,
          assignee_email: t.assigned_to ? emailMap.get(t.assigned_to) || t.assigned_to : undefined,
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [orgId, teamId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);

    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert({
        team_id: teamId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: newStatus,
        priority: newPriority,
        assigned_to: newAssignee || null,
        target_shift_name: newShiftName.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      alert(`Failed to create task: ${error.message}`);
    } else {
      setShowNewModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("normal");
      setNewAssignee("");
      setNewShiftName("");
      await loadData();
    }

    setCreating(false);
  };

  const handleMoveTaskStatus = async (taskId: string, newStat: Task["status"]) => {
    const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, status: newStat } : t));
    setTasks(updatedTasks);

    const { error } = await supabase
      .from("tasks")
      .update({ status: newStat, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      console.error("Error updating status:", error);
      await loadData(); // revert
    }
  };

  const handleOpenTask = async (task: Task) => {
    setSelectedTask(task);
    setComments([]);

    const { data: comms } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });

    if (comms && comms.length > 0) {
      const uIds = Array.from(new Set(comms.map((c) => c.user_id).filter(Boolean)));
      const { data: profs } = await supabase.from("profiles").select("id, email").in("id", uIds);
      const eMap = new Map(profs?.map((p) => [p.id, p.email]) || []);
      setComments(comms.map((c) => ({ ...c, user_email: eMap.get(c.user_id) || "Worker" })));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;

    setPostingComment(true);
    const { data: comm, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: selectedTask.id,
        user_id: user.id,
        content: newComment.trim(),
      })
      .select()
      .single();

    if (!error && comm) {
      setComments([...comments, { ...comm, user_email: user.email }]);
      setNewComment("");
    }
    setPostingComment(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    setTasks(tasks.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) setSelectedTask(null);

    await supabase.from("tasks").delete().eq("id", taskId);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesQuery =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchesQuery && matchesPriority;
  });

  const getPriorityBadge = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Urgent</span>;
      case "high":
        return <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded font-medium">High</span>;
      case "normal":
        return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">Normal</span>;
      case "low":
        return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-medium">Low</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Ops Kanban...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-slate-950/80 border-b border-slate-800 px-6 py-4 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/org/${orgId}/team/${teamId}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                B
              </div>
              <span className="font-bold text-lg text-white">Balito Ops</span>
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 font-medium">{team?.name}</span>
            <span className="text-slate-600">/</span>
            <span className="text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs">
              Shift Board
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/org/${orgId}/team/${teamId}`}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Back to Team
            </Link>
            <button
              onClick={() => setShowNewModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <span>+ New Task</span>
            </button>
          </div>
        </div>
      </header>

      {/* Board Controls & Filters */}
      <div className="bg-slate-950/40 border-b border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search tasks, equipment, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="normal">🔵 Normal</option>
              <option value="low">⚪ Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[1100px]">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className={`rounded-xl border ${col.color} p-4 flex flex-col min-h-[600px] shadow-inner`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-slate-900">{col.label}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Task Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-300/40 rounded-lg">
                      No tasks in {col.label}
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleOpenTask(task)}
                        className="bg-white rounded-lg p-3.5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                            {task.title}
                          </span>
                          {getPriorityBadge(task.priority)}
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                          <span className="truncate max-w-[120px]">
                            {task.assignee_email ? `👤 ${task.assignee_email.split("@")[0]}` : "Unassigned"}
                          </span>
                          {task.target_shift_name && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                              {task.target_shift_name}
                            </span>
                          )}
                        </div>

                        {/* Move Status Quick Buttons */}
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-slate-400">Move status:</span>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {col.id !== "todo" && (
                              <button
                                onClick={() => handleMoveTaskStatus(task.id, "todo")}
                                title="Move to To Do"
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded"
                              >
                                To Do
                              </button>
                            )}
                            {col.id !== "in_progress" && (
                              <button
                                onClick={() => handleMoveTaskStatus(task.id, "in_progress")}
                                title="Move to In Progress"
                                className="px-1.5 py-0.5 bg-amber-50 text-amber-600 hover:bg-amber-100 text-[10px] font-bold rounded"
                              >
                                In Prog
                              </button>
                            )}
                            {col.id !== "completed" && (
                              <button
                                onClick={() => handleMoveTaskStatus(task.id, "completed")}
                                title="Mark Completed"
                                className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[10px] font-bold rounded"
                              >
                                Done
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* CREATE TASK MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Create Operations Task</h2>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect Conveyor Belt 3 Motor"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Detailed instructions or machine status..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Column / Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="urgent">🔴 Urgent</option>
                    <option value="high">🟠 High</option>
                    <option value="normal">🔵 Normal</option>
                    <option value="low">⚪ Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assign Worker</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Target Shift Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Night Shift"
                    value={newShiftName}
                    onChange={(e) => setNewShiftName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAILS & COMMENTS MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityBadge(selectedTask.priority)}
                  <span className="text-xs text-slate-400 uppercase font-mono tracking-wider">
                    {selectedTask.status.replace("_", " ")}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{selectedTask.title}</h2>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {selectedTask.description && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 text-sm text-slate-300 mb-6">
                {selectedTask.description}
              </div>
            )}

            {/* Shift Comments Thread */}
            <div className="border-t border-slate-800 pt-4 mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Shift Notes & Comments</h3>

              <div className="space-y-3 max-h-48 overflow-y-auto mb-4 pr-1">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-500">No shift comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-blue-400">{c.user_email}</span>
                        <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-200">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment or update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={postingComment || !newComment.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Post
                </button>
              </form>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500">
              <button
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                Delete Task
              </button>
              <span>Created {new Date(selectedTask.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
