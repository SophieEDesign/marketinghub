import { Database, Users, Wallet } from "lucide-react";
import { ModuleCard, PageHeader } from "@/components/ui/PageHeader";

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Admin"
        description="Manage hub users and edit raw data tables."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          href="/app/admin/users"
          title="Users"
          description="See who’s on Supabase — Admin, Member, or External — and invite people."
          icon={Users}
        />
        <ModuleCard
          href="/app/admin/data"
          title="Data tables"
          description="Spreadsheet view of events, content, contacts, and other collections."
          icon={Database}
        />
        <ModuleCard
          href="/app/budget"
          title="Budget"
          description="2026 marketing budget — admins, plus Simon, Tom, and Michael."
          icon={Wallet}
        />
      </div>
    </div>
  );
}
