"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";

interface Briefing {
  id: string;
  title: string;
  content_id?: string;
}

export default function BriefingsList() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openRecord } = useRecordDrawer();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("briefings")
        .select("id, title, content_id")
        .order("created_at", { ascending: false })
        .limit(6);

      if (data) {
        setBriefings(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading briefings...</div>
    );
  }

  if (briefings.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No briefings. <button onClick={() => router.push("/briefings/grid")} className="text-brand-blue hover:underline">View all</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {briefings.map((item) => (
        <button
          key={item.id}
          onClick={() => openRecord("briefings", item.id)}
          className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.title}</div>
          </div>
        </button>
      ))}
      <button
        onClick={() => router.push("/briefings/grid")}
        className="w-full text-sm text-brand-blue hover:underline text-left mt-2"
      >
        View all briefings →
      </button>
    </div>
  );
}

