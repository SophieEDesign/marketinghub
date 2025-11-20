"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";

interface StrategyItem {
  id: string;
  title: string;
  category?: string;
}

export default function StrategyList() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openRecord } = useRecordDrawer();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("strategy")
        .select("id, title, category")
        .order("created_at", { ascending: false })
        .limit(6);

      if (data) {
        setStrategies(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading strategy items...</div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No strategy items. <button onClick={() => router.push("/strategy/grid")} className="text-brand-blue hover:underline">View all</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {strategies.map((item) => (
        <button
          key={item.id}
          onClick={() => openRecord("strategy", item.id)}
          className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Compass className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.title}</div>
            {item.category && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.category}</div>
            )}
          </div>
        </button>
      ))}
      <button
        onClick={() => router.push("/strategy/grid")}
        className="w-full text-sm text-brand-blue hover:underline text-left mt-2"
      >
        View all strategy →
      </button>
    </div>
  );
}

