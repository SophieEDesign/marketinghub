import { TasksClient } from "@/components/tasks/TasksClient";
import { listTasks } from "@/lib/data/repos";
import { hasSupabaseConfig } from "@/lib/auth/config";

export default async function TasksPage() {
  return (
    <TasksClient
      initial={await listTasks()}
      supabaseReady={hasSupabaseConfig()}
    />
  );
}
