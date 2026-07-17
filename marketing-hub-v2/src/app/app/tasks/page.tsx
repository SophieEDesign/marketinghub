import { TasksClient } from "@/components/tasks/TasksClient";
import { listTasks } from "@/lib/data/repos";

export default async function TasksPage() {
  return <TasksClient initial={await listTasks()} />;
}
