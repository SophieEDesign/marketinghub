"use client";

interface KanbanPageProps {
  page: any;
  data?: any;
  [key: string]: any;
}

export default function KanbanPage(props: KanbanPageProps) {
  return (
    <div className="p-6 text-gray-500">
      Kanban Board page type placeholder
    </div>
  );
}
