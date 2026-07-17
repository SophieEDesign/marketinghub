import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import { isAutoMemberEmail } from "@/lib/auth/member-domain";
import {
  createAccessRequest,
  createHubUser,
  findPendingAccessRequestByEmail,
  listAccessRequests,
  updateAccessRequest,
} from "@/lib/data/repos";
import {
  hasServiceRoleKey,
  inviteSupabaseHubUser,
} from "@/lib/supabase/hub-users";

async function inviteForRequest(input: {
  email: string;
  full_name: string;
  role: "member" | "external";
  notes?: string;
  organisation?: string;
}) {
  if (hasServiceRoleKey()) {
    return inviteSupabaseHubUser({
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      notes: input.notes ?? "",
      organisation: input.organisation,
    });
  }
  return createHubUser({
    email: input.email,
    full_name: input.full_name,
    role: input.role,
    notes: input.notes ?? "",
    organisation: input.organisation,
  });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return jsonOk({ requests: await listAccessRequests() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "approve" || action === "deny") {
    const { error, user } = await requireAdmin();
    if (error) return error;

    const id = String(body.id ?? "");
    if (!id) return jsonError("Request id is required");

    const all = await listAccessRequests();
    const existing = all.find((r) => r.id === id);
    if (!existing) return jsonError("Not found", 404);
    if (existing.status !== "pending" && existing.status !== "failed") {
      return jsonError("Request is no longer pending");
    }

    const decidedBy = user?.email ?? user?.full_name ?? "admin";

    if (action === "deny") {
      const updated = await updateAccessRequest(id, {
        status: "denied",
        decided_role: "external",
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        error_message: "",
      });
      return jsonOk({ item: updated });
    }

    try {
      await inviteForRequest({
        email: existing.email,
        full_name: existing.full_name,
        role: "external",
        organisation: existing.organisation,
        notes: existing.organisation
          ? `Access request — ${existing.organisation}`
          : "Access request (external)",
      });
      const updated = await updateAccessRequest(id, {
        status: "approved",
        decided_role: "external",
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        error_message: "",
      });
      return jsonOk({
        item: updated,
        source: hasServiceRoleKey() ? "supabase" : "local",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send invite";
      const updated = await updateAccessRequest(id, {
        status: "failed",
        error_message: message,
      });
      return jsonError(message, 400, { item: updated });
    }
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();
  const organisation = String(body.organisation ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const requestedRole = String(body.requested_role ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return jsonError("A valid email is required");
  }
  if (!fullName) {
    return jsonError("Full name is required");
  }

  // Defence in depth: non–P&M cannot request Member via the public form.
  if (requestedRole === "member" && !isAutoMemberEmail(email)) {
    return jsonError(
      "Member access cannot be requested for this email. Ask an admin to invite you, or leave the role blank for External media access."
    );
  }

  const duplicate = await findPendingAccessRequestByEmail(email);
  if (duplicate) {
    return jsonError("A pending request already exists for this email");
  }

  if (isAutoMemberEmail(email)) {
    const item = await createAccessRequest({
      full_name: fullName,
      email,
      requested_role: "member",
      organisation,
      reason,
      status: "approved",
      decided_role: "member",
      decided_at: new Date().toISOString(),
      decided_by: "auto:member-domain",
      error_message: "",
    });

    try {
      await inviteForRequest({
        email,
        full_name: fullName,
        role: "member",
        organisation,
        notes: organisation
          ? `Auto Member — ${organisation}`
          : "Auto Member (Peters & May email)",
      });
      return jsonOk(
        {
          item,
          outcome: "auto_member",
          message: "Invite sent — check your email to set a password.",
          source: hasServiceRoleKey() ? "supabase" : "local",
        },
        { status: 201 }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send invite";
      const failed = await updateAccessRequest(item.id, {
        status: "failed",
        error_message: message,
      });
      return jsonError(message, 400, { item: failed, outcome: "failed" });
    }
  }

  const item = await createAccessRequest({
    full_name: fullName,
    email,
    requested_role: "external",
    organisation,
    reason,
    status: "pending",
    decided_role: null,
    decided_at: null,
    decided_by: null,
    error_message: "",
  });

  return jsonOk(
    {
      item,
      outcome: "pending_external",
      message: "Request received — we’ll review it shortly.",
    },
    { status: 201 }
  );
}
