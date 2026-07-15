"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  user_email?: string;
}

export default function OrgMembersPage() {
  const [user, setUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      const { data: orgData } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (!orgData) {
        router.push("/org/new");
        return;
      }
      setOrg(orgData);

      const { data: membersData } = await supabase
        .from("org_members")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      // Fetch emails for each member
      const membersWithEmails = await Promise.all(
        (membersData || []).map(async (m) => {
          const { data } = await supabase.auth.admin.getUserById(m.user_id);
          return { ...m, user_email: data?.user?.email || "Unknown" };
        })
      );

      setMembers(membersWithEmails);
      setLoading(false);
    };

    loadData();
  }, [orgId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);

    // For now, just add them as a member directly (in production, send invite email)
    // This is a simplified flow - the user would need to exist in auth already
    const { error } = await supabase
      .from("org_members")
      .insert({ org_id: orgId, user_id: inviteEmail, role: "member" });

    if (error) {
      // User might not exist yet - show message
      alert("User not found. They need to sign up first, or use team invite codes.");
    } else {
      setInviteEmail("");
      // Reload members
      const { data } = await supabase
        .from("org_members")
        .select("*")
        .eq("org_id", orgId);
      setMembers(data || []);
    }

    setInviting(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the organization?")) return;

    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      alert("Failed to remove member.");
    } else {
      setMembers(members.filter((m) => m.id !== memberId));
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={`/org/${orgId}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Balito</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Members</h1>
            <p className="text-slate-600">{org?.name}</p>
          </div>
          <Link
            href={`/org/${orgId}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Organization
          </Link>
        </div>

        {/* Members List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Organization Members ({members.length})
          </h2>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border border-slate-200 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{member.user_email}</p>
                  <p className="text-sm text-slate-500 capitalize">{member.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      member.role === "owner"
                        ? "bg-purple-100 text-purple-700"
                        : member.role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {member.role}
                  </span>
                  {member.role !== "owner" && member.user_id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Member (simplified - for production, use email invites) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Add Member by User ID
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            For production, use team invite codes or email invites instead.
          </p>
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="text"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="User ID"
              required
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="submit"
              disabled={inviting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
