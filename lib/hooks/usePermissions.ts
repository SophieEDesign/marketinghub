"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserRole = "admin" | "editor" | "viewer";

interface Permissions {
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canModifyViews: boolean;
  canModifyDashboards: boolean;
  canModifyTableStructure: boolean;
  canManageRoles: boolean;
  role: UserRole | null;
  loading: boolean;
}

const defaultPermissions: Permissions = {
  canEdit: true,
  canDelete: true,
  canCreate: true,
  canModifyViews: true,
  canModifyDashboards: true,
  canModifyTableStructure: false,
  canManageRoles: false,
  role: null,
  loading: true,
};

export function usePermissions(): Permissions {
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);

  useEffect(() => {
    async function loadPermissions() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Default to editor if no user (for development)
          setPermissions({
            ...defaultPermissions,
            role: "editor",
            loading: false,
          });
          return;
        }

        // Get user role
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          // PGRST116 is "no rows returned", which is fine
          console.error("Error loading user role:", error);
        }

        const role: UserRole = roleData?.role || "editor"; // Default to editor

        // Calculate permissions based on role
        const perms: Permissions = {
          role,
          loading: false,
          canEdit: role === "admin" || role === "editor",
          canDelete: role === "admin" || role === "editor",
          canCreate: role === "admin" || role === "editor",
          canModifyViews: role === "admin" || role === "editor",
          canModifyDashboards: role === "admin" || role === "editor",
          canModifyTableStructure: role === "admin",
          canManageRoles: role === "admin",
        };

        setPermissions(perms);
      } catch (error) {
        console.error("Error loading permissions:", error);
        // Default to editor on error
        setPermissions({
          ...defaultPermissions,
          role: "editor",
          loading: false,
        });
      }
    }

    loadPermissions();
  }, []);

  return permissions;
}

