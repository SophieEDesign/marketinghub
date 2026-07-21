import { TasksClient } from "@/components/tasks/TasksClient";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listTasks } from "@/lib/data/repos";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, fieldOptions] = await Promise.all([
    listTasks(),
    getFieldOptionsMap("tasks"),
  ]);
  return <TasksClient initial={tasks} fieldOptions={fieldOptions} />;
}
