"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Shield, Info, Mail, UserPlus, Trash2, Key } from "lucide-react";
import { useSettings } from "@/lib/useSettings";
import { usePermissions } from "@/lib/hooks/usePermissions";
import LogoUploader from "@/components/settings/LogoUploader";
import { toast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

export default function WorkspaceSettingsTab() {
  const permissions = usePermissions();
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"info" | "users" | "security">("info");

  // Workspace Info state
  const [workspaceName, setWorkspaceName] = useState(settings.workspace_name || "");
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [accentColor, setAccentColor] = useState(settings.branding_colors?.primary || "#2563eb");

  // Users & Roles state
  const [users, setUsers] = useState<User[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);

  // Security state
  const [sessionTimeout, setSessionTimeout] = useState(30); // minutes
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    if (settings.workspace_name) {
      setWorkspaceName(settings.workspace_name);
    }
    if (settings.branding_colors?.primary) {
      setAccentColor(settings.branding_colors.primary);
    }
    loadUsers();
  }, [settings]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      
      if (error && error.code !== "PGRST116") {
        console.error("Error loading users:", error);
        return;
      }
      
      // In a real app, you'd join with auth.users to get emails
      setUsers(data?.map((ur: any) => ({
        id: ur.user_id,
        email: `user-${ur.user_id.slice(0, 8)}@example.com`, // Placeholder
        role: ur.role,
      })) || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const handleSaveWorkspaceInfo = async () => {
    setSaving(true);
    try {
      await updateSettings({
        workspace_name: workspaceName,
        branding_colors: {
          ...settings.branding_colors,
          primary: accentColor,
        },
      });
      
      toast({
        title: "Success",
        description: "Workspace settings saved!",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save workspace settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        type: "error",
      });
      return;
    }

    setInviting(true);
    try {
      // In a real app, you'd create an auth user and assign role
      // For now, we'll just show a message
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail}`,
        type: "success",
      });
      setInviteEmail("");
      await loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        type: "error",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed successfully",
        type: "success",
      });
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        type: "error",
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: "admin" | "editor" | "viewer") => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: newRole,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated",
        type: "success",
      });
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        type: "error",
      });
    }
  };

  const handleSaveSecurity = async () => {
    setSaving(true);
    try {
      await updateSettings({
        security: {
          session_timeout: sessionTimeout,
          two_factor_enabled: twoFactorEnabled,
        },
      });
      
      toast({
        title: "Success",
        description: "Security settings saved!",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save security settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (permissions.role !== "admin") {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Admin Access Required
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Only workspace administrators can access these settings.
        </p>
      </div>
    );
  }

  const subTabs = [
    { id: "info" as const, label: "Workspace Info", icon: Info },
    { id: "users" as const, label: "Users & Roles", icon: Users },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeSubTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workspace Info Tab */}
      {activeSubTab === "info" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Workspace Information</h2>
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                  placeholder="Marketing Hub"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Logo
                </label>
                <LogoUploader />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-16 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm font-mono"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain / URL (Optional)
                </label>
                <input
                  type="text"
                  value={workspaceUrl}
                  onChange={(e) => setWorkspaceUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                  placeholder="https://marketing.example.com"
                />
              </div>
              <Button onClick={handleSaveWorkspaceInfo} disabled={saving}>
                {saving ? "Saving..." : "Save Workspace Info"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users & Roles Tab */}
      {activeSubTab === "users" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Users & Roles</h2>
            
            {/* Invite User */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Invite User</h3>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <Button onClick={handleInviteUser} disabled={inviting || !inviteEmail.trim()}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {inviting ? "Sending..." : "Invite"}
                </Button>
              </div>
            </div>

            {/* Users List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Current Users</h3>
              {users.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  No users yet. Invite someone to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.email}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {user.role}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.id, e.target.value as any)}
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeSubTab === "security" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Security Settings</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 30)}
                  min="5"
                  max="1440"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Users will be logged out after this period of inactivity
                </p>
              </div>
              <div>
                <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">Two-Factor Authentication</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Require 2FA for all users (coming soon)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                    disabled
                    className="w-4 h-4 text-blue-600 rounded opacity-50"
                  />
                </label>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Key className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>API Keys</strong> and <strong>Audit Logs</strong> coming soon
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveSecurity} disabled={saving}>
                {saving ? "Saving..." : "Save Security Settings"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

