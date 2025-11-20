"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";

interface Sponsorship {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
}

export default function SponsorshipsList() {
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openRecord } = useRecordDrawer();

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      
      const { data } = await supabase
        .from("sponsorships")
        .select("id, name, start_date, end_date")
        .or(`end_date.gte.${today},end_date.is.null`)
        .order("start_date", { ascending: true })
        .limit(6);

      if (data) {
        setSponsorships(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading sponsorships...</div>
    );
  }

  if (sponsorships.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No upcoming sponsorships. <button onClick={() => router.push("/sponsorships/grid")} className="text-brand-blue hover:underline">View all</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sponsorships.map((item) => (
        <button
          key={item.id}
          onClick={() => openRecord("sponsorships", item.id)}
          className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Gift className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.name}</div>
            {item.start_date && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(item.start_date).toLocaleDateString()}
                {item.end_date && ` - ${new Date(item.end_date).toLocaleDateString()}`}
              </div>
            )}
          </div>
        </button>
      ))}
      <button
        onClick={() => router.push("/sponsorships/grid")}
        className="w-full text-sm text-brand-blue hover:underline text-left mt-2"
      >
        View all sponsorships →
      </button>
    </div>
  );
}

