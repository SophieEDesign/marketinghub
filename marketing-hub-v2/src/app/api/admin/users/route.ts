import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import {
  createHubUser,
  deleteHubUser,
  linkUserToContact,
  listHubUsers,
  updateHubUser,
} from "@/lib/data/repos";
import type { HubAccessRole } from "@/lib/types";
import {
  deleteSupabaseHubUser,
  hasServiceRoleKey,
  inviteSupabaseHubUser,
  listSupabaseHubUsers,
  updateSupabaseHubUser,
} from "@/lib/supabase/hub-users";

const ROLES: HubAccessRole[] = ["admin", "member", "external"];

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    if (hasServiceRoleKey()) {
      return jsonOk({
        users: await listSupabaseHubUsers(),
        source: "supabase",
      });
    }
    return jsonOk({ users: await listHubUsers(), source: "local" });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to load users",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;
  const useSupabase = hasServiceRoleKey();

  try {
    if (action === "update") {
      const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
      if (patch.role !== undefined && !ROLES.includes(patch.role as HubAccessRole)) {
        return jsonError("Role must be admin, member, or external");
      }

      if ("contact_id" in patch) {
        const contactId =
          patch.contact_id === null || patch.contact_id === ""
            ? null
            : String(patch.contact_id);
        await linkUserToContact(body.id, contactId);
        delete patch.contact_id;
      }

      const hasUserFields =
        patch.role !== undefined ||
        patch.full_name !== undefined ||
        patch.notes !== undefined ||
        patch.email !== undefined;

      let updated = null;
      if (hasUserFields) {
        updated = useSupabase
          ? await updateSupabaseHubUser(body.id, patch)
          : await updateHubUser(body.id, patch);
        if (!updated) return jsonError("Not found", 404);
      } else {
        // Contact link-only update — still return the user record.
        const users = useSupabase
          ? await listSupabaseHubUsers()
          : await listHubUsers();
        updated = users.find((u) => u.id === body.id) ?? null;
        if (!updated) return jsonError("Not found", 404);
      }

      return jsonOk({
        item: updated,
        source: useSupabase ? "supabase" : "local",
      });
    }

    if (action === "delete") {
      if (useSupabase) {
        await deleteSupabaseHubUser(body.id);
      } else {
        await deleteHubUser(body.id);
      }
      return jsonOk({ ok: true });
    }

    const role = (body.role as HubAccessRole) ?? "member";
    if (!ROLES.includes(role)) {
      return jsonError("Role must be admin, member, or external");
    }
    if (!String(body.email ?? "").trim()) {
      return jsonError("Email is required");
    }

    const item = useSupabase
      ? await inviteSupabaseHubUser({
          email: body.email,
          full_name: body.full_name ?? "",
          role,
          notes: body.notes ?? "",
        })
      : await createHubUser({
          email: body.email,
          full_name: body.full_name ?? "",
          role,
          notes: body.notes ?? "",
        });

    return jsonOk(
      { item, source: useSupabase ? "supabase" : "local" },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "User action failed",
      400
    );
  }
}
