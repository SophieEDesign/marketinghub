"use client";

import { useMemo } from "react";
import { Calendar, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

interface TasksDueConfig {
  title?: string;
  table?: string;
  dueDateField?: string;
  statusField?: string;
  limit?: number;
}

interface TasksDueModuleProps {
  config: TasksDueConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<TasksDueConfig>) => void;
  isEditing?: boolean;
  data?: any[];
}

export default function TasksDueModule({ config, width, height, onUpdate, isEditing = false, data = [] }: TasksDueModuleProps) {
  const tasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const dueDateField = config.dueDateField || "due_date";
    const statusField = config.statusField || "status";

    return data
      .filter((task) => {
        const dueDate = task[dueDateField];
        if (!dueDate) return false;
        const due = new Date(dueDate);
        return due <= nextWeek;
      })
      .sort((a, b) => {
        const dateA = new Date(a[config.dueDateField || "due_date"] || 0);
        const dateB = new Date(b[config.dueDateField || "due_date"] || 0);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, config.limit || 10);
  }, [data, config]);

  const getDueStatus = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (due < today) return "overdue";
    if (due < tomorrow) return "today";
    return "upcoming";
  };

  const getStatusIcon = (status: string) => {
    if (status === "overdue") return <Clock className="w-4 h-4 text-red-600" />;
    if (status === "today") return <Calendar className="w-4 h-4 text-orange-600" />;
    return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
  };

  const getStatusColor = (status: string) => {
    if (status === "overdue") return "text-red-600 bg-red-50 dark:bg-red-900/20";
    if (status === "today") return "text-orange-600 bg-orange-50 dark:bg-orange-900/20";
    return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
  };

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
          {config.title || "Tasks Due"}
        </h3>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No tasks due soon
            </div>
          ) : (
            tasks.map((task) => {
              const dueStatus = getDueStatus(task[config.dueDateField || "due_date"]);
              const title = task.title || task.name || "Untitled";
              const dueDate = new Date(task[config.dueDateField || "due_date"]);
              const formattedDate = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {getStatusIcon(dueStatus)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {title}
                    </div>
                    <div className={`text-xs ${getStatusColor(dueStatus)} px-2 py-0.5 rounded inline-block mt-1`}>
                      {formattedDate}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

