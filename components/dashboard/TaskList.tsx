"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import { Calendar } from "lucide-react";
import dayjs from "dayjs";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { openRecord } = useRecordDrawer();

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];

      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10);

      if (data) {
        setTasks(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  const handleTaskClick = (taskId: string) => {
    openRecord("tasks", taskId);
  };

  const getDueDateColor = (dueDate: string | null): string => {
    if (!dueDate) return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";

    const daysUntil = dayjs(dueDate).diff(dayjs(), "day");

    if (daysUntil < 0) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    if (daysUntil === 0) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    if (daysUntil <= 3) return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
    return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  };

  const formatDueDate = (dueDate: string | null): string => {
    if (!dueDate) return "No due date";
    const daysUntil = dayjs(dueDate).diff(dayjs(), "day");
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil === 0) return "Due today";
    if (daysUntil === 1) return "Due tomorrow";
    return `Due in ${daysUntil} days`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-heading text-brand-blue mb-4">Upcoming Tasks</h2>
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-heading text-brand-blue mb-4">Upcoming Tasks</h2>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-sm">No upcoming tasks</div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task.id)}
              className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {task.title}
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getDueDateColor(task.due_date)}`}>
                <Calendar className="w-3 h-3" />
                <span>{formatDueDate(task.due_date)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

