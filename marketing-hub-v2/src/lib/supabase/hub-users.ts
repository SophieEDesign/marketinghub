import type { User } from "@supabase/supabase-js";
import { hasSupabaseConfig } from "@/lib/auth/config";
import {
  createAdminClient,
  hasServiceRoleKey,
} from "@/lib/supabase/admin";
import type { HubAccessRole, HubUser } from "@/lib/types";

const ROLES: HubAccessRole[] = ["admin", "member", "external"];

export { hasServiceRoleKey };

export function normalizeHubAccessRole(value: unknown): HubAccessRole {
  const role = String(value ?? "").toLowerCase();
  return ROLES.includes(role as HubAccessRole)
    ? (role as HubAccessRole)
    : "member";
}

function displayName(user: User): string {
  const meta = user.user_metadata ?? {};
  return (
    (meta.full_name as string | undefined)?.trim() ||
    (meta.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "User"
  );
}

function toHubUser(
  user: User,
  profileRole: string | null | undefined,
  profileEmail?: string | null
): HubUser {
  const meta = user.user_metadata ?? {};
  const appRole = (user.app_metadata as { role?: string } | undefined)?.role;
  return {
    id: user.id,
    email: (profileEmail || user.email || "").trim().toLowerCase(),
    full_name: displayName(user),
    role: normalizeHubAccessRole(profileRole ?? appRole),
    notes: String(meta.notes ?? ""),
    last_sign_in_at: user.last_sign_in_at ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };
}

async function listAllAuthUsers() {
  const supabase = createAdminClient();
  const users: User[] = [];
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }

  return users;
}

export async function listSupabaseHubUsers(): Promise<HubUser[]> {
  const supabase = createAdminClient();
  const [authUsers, profilesRes] = await Promise.all([
    listAllAuthUsers(),
    supabase
      .from("profiles")
      .select("user_id, role, email, is_archived")
      .or("is_archived.is.null,is_archived.eq.false"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const roleByUser = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.user_id as string,
      {
        role: p.role as string,
        email: (p.email as string | null) ?? null,
      },
    ])
  );

  const users = authUsers.map((u) => {
    const profile = roleByUser.get(u.id);
    return toHubUser(u, profile?.role, profile?.email);
  });

  return users.sort((a, b) => {
    const order = { admin: 0, member: 1, external: 2 } as const;
    const byRole = order[a.role] - order[b.role];
    if (byRole !== 0) return byRole;
    return a.full_name.localeCompare(b.full_name);
  });
}

async function upsertProfile(
  userId: string,
  email: string,
  role: HubAccessRole
) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        role,
        email,
        updated_at: new Date().toISOString(),
        is_archived: false,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("profiles").insert({
    user_id: userId,
    role,
    email,
  });
  if (error) throw new Error(error.message);
}

async function syncAuthMetadata(
  userId: string,
  role: HubAccessRole,
  fullName?: string,
  notes?: string,
  existing?: User
) {
  const supabase = createAdminClient();
  const user =
    existing ??
    (await supabase.auth.admin.getUserById(userId)).data.user ??
    undefined;

  const patch: {
    app_metadata: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  } = {
    app_metadata: {
      ...(user?.app_metadata ?? {}),
      role,
    },
  };
  if (fullName !== undefined || notes !== undefined) {
    patch.user_metadata = {
      ...(user?.user_metadata ?? {}),
    };
    if (fullName !== undefined) patch.user_metadata.full_name = fullName;
    if (notes !== undefined) patch.user_metadata.notes = notes;
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, patch);
  if (error) throw new Error(error.message);
}

export async function inviteSupabaseHubUser(input: {
  email: string;
  full_name: string;
  role: HubAccessRole;
  notes?: string;
}): Promise<HubUser> {
  const supabase = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const role = normalizeHubAccessRole(input.role);
  const fullName = input.full_name.trim() || email.split("@")[0];
  const notes = input.notes ?? "";

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      notes,
      role,
    },
  });
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("Invite succeeded but no user returned");

  await upsertProfile(user.id, email, role);
  await syncAuthMetadata(user.id, role, fullName, notes, user);

  return toHubUser(
    {
      ...user,
      user_metadata: {
        ...user.user_metadata,
        full_name: fullName,
        notes,
      },
      app_metadata: { ...user.app_metadata, role },
    },
    role,
    email
  );
}

export async function updateSupabaseHubUser(
  id: string,
  patch: Partial<Pick<HubUser, "role" | "full_name" | "notes" | "email">>
): Promise<HubUser | null> {
  const supabase = createAdminClient();
  const { data: existing, error: getError } =
    await supabase.auth.admin.getUserById(id);
  if (getError) throw new Error(getError.message);
  if (!existing.user) return null;

  const role = patch.role
    ? normalizeHubAccessRole(patch.role)
    : normalizeHubAccessRole(
        (
          await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", id)
            .maybeSingle()
        ).data?.role ??
          (existing.user.app_metadata as { role?: string })?.role
      );

  const fullName =
    patch.full_name !== undefined
      ? patch.full_name.trim()
      : displayName(existing.user);
  const notes =
    patch.notes !== undefined
      ? patch.notes
      : String(existing.user.user_metadata?.notes ?? "");
  const email =
    patch.email !== undefined
      ? patch.email.trim().toLowerCase()
      : (existing.user.email ?? "").toLowerCase();

  if (patch.email && patch.email !== existing.user.email) {
    const { error } = await supabase.auth.admin.updateUserById(id, { email });
    if (error) throw new Error(error.message);
  }

  await syncAuthMetadata(id, role, fullName, notes, existing.user);
  await upsertProfile(id, email, role);

  const { data: refreshed, error: refreshError } =
    await supabase.auth.admin.getUserById(id);
  if (refreshError) throw new Error(refreshError.message);
  if (!refreshed.user) return null;

  return toHubUser(refreshed.user, role, email);
}

export async function deleteSupabaseHubUser(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}

/** Resolve hub role from profiles (preferred) or app_metadata. */
export async function getProfileRoleForUser(
  userId: string
): Promise<HubAccessRole | null> {
  if (!hasSupabaseConfig()) return null;

  try {
    if (hasServiceRoleKey()) {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.role) return normalizeHubAccessRole(data.role);
      return null;
    }

    const { createClient: createServerClient } = await import(
      "@/lib/supabase/server"
    );
    const server = await createServerClient();
    const { data } = await server
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.role) return normalizeHubAccessRole(data.role);
    return null;
  } catch {
    return null;
  }
}

export function hubRoleToSessionRole(
  role: HubAccessRole
): "admin" | "staff" | "media_guest" {
  if (role === "admin") return "admin";
  if (role === "external") return "media_guest";
  return "staff";
}
