"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PageView from "@/components/pages/PageView";

export const dynamic = 'force-dynamic';

function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        Loading dashboard...
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [dashboardPageId, setDashboardPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Find or create a page with layout="dashboard" named "Dashboard"
    const findOrCreateDashboard = async () => {
      try {
        // First, try to find an existing dashboard page
        const { data: existingPages, error: findError } = await supabase
          .from("pages")
          .select("id")
          .eq("layout", "dashboard")
          .eq("name", "Dashboard")
          .limit(1)
          .maybeSingle();

        if (findError && findError.code !== "PGRST116") {
          console.error("Error finding dashboard:", findError);
        }

        if (existingPages) {
          setDashboardPageId(existingPages.id);
          setLoading(false);
          return;
        }

        // If no dashboard page exists, create one
        const { data: newPage, error: createError } = await supabase
          .from("pages")
          .insert({
            name: "Dashboard",
            layout: "dashboard",
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating dashboard page:", createError);
          setLoading(false);
          return;
        }

        setDashboardPageId(newPage.id);
        setLoading(false);
      } catch (error) {
        console.error("Error in findOrCreateDashboard:", error);
        setLoading(false);
      }
    };

    findOrCreateDashboard();
  }, []);

  if (loading) {
    return <DashboardLoading />;
  }

  if (!dashboardPageId) {
    return (
      <div className="p-6">
        <div className="text-center text-red-500">Failed to load dashboard</div>
      </div>
    );
  }

  return <PageView pageId={dashboardPageId} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

