"use client";

import { useState, useEffect } from "react";
import { User, Palette, Bell, Keyboard, Mail } from "lucide-react";
import { useSettings } from "@/lib/useSettings";
import { toast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";

export default function AccountSettingsTab() {
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "appearance" | "notifications" | "shortcuts">("profile");

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");

  // Appearance state
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Notifications state
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [activityUpdates, setActivityUpdates] = useState(true);
  const [automationFailures, setAutomationFailures] = useState(true);

  useEffect(() => {
    // Load user profile (would come from auth in real app)
    setProfileName("User Name");
    setProfileEmail("user@example.com");
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Save profile (would update user record in real app)
      toast({
        title: "Success",
        description: "Profile updated successfully!",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppearance = async () => {
    setSaving(true);
    try {
      // Apply theme
      if (theme === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", prefersDark);
      } else {
        document.documentElement.classList.toggle("dark", theme === "dark");
      }
      
      // Save to settings
      await updateSettings({ theme });
      
      toast({
        title: "Success",
        description: "Appearance settings saved!",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save appearance settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await updateSettings({
        notifications: {
          weekly_summary: weeklySummary,
          activity_updates: activityUpdates,
          automation_failures: automationFailures,
        },
      });
      
      toast({
        title: "Success",
        description: "Notification preferences saved!",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const subTabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "shortcuts" as const, label: "Keyboard Shortcuts", icon: Keyboard },
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

      {/* Profile Tab */}
      {activeSubTab === "profile" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeSubTab === "appearance" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <div className="space-y-2">
                  {(["light", "dark", "system"] as const).map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={option}
                        checked={theme === option}
                        onChange={() => setTheme(option)}
                        className="text-blue-600"
                      />
                      <span className="text-sm capitalize">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleSaveAppearance} disabled={saving}>
                {saving ? "Saving..." : "Save Appearance"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeSubTab === "notifications" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
            <div className="space-y-4 max-w-md">
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Weekly Summary Email</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Receive a weekly summary of your activity
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={weeklySummary}
                  onChange={(e) => setWeeklySummary(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Activity Updates</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get notified about important activity
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={activityUpdates}
                  onChange={(e) => setActivityUpdates(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Automation Failures</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get notified when automations fail
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={automationFailures}
                  onChange={(e) => setAutomationFailures(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>
              <Button onClick={handleSaveNotifications} disabled={saving}>
                {saving ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Tab */}
      {activeSubTab === "shortcuts" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Keyboard Shortcuts</h2>
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Open Command Palette</div>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                  Cmd/Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Create New Record</div>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                  Cmd/Ctrl + N
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Save Record</div>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                  Cmd/Ctrl + S
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Undo</div>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                  Cmd/Ctrl + Z
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

