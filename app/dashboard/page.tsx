import { Suspense } from "react";
import Dashboard from "@/components/dashboard/Dashboard";

function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        Loading dashboard...
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
}

