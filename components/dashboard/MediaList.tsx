"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Newspaper } from "lucide-react";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";

interface MediaItem {
  id: string;
  publication: string;
  date: string;
  url?: string;
}

export default function MediaList() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openRecord } = useRecordDrawer();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("media")
        .select("id, publication, date, url")
        .order("date", { ascending: false })
        .limit(10);

      if (data) {
        setMedia(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading recent media...</div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No recent media. <button onClick={() => router.push("/media/grid")} className="text-brand-blue hover:underline">View all media</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {media.map((item) => (
        <button
          key={item.id}
          onClick={() => openRecord("media", item.id)}
          className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Newspaper className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.publication}</div>
            {item.date && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(item.date).toLocaleDateString()}
              </div>
            )}
          </div>
        </button>
      ))}
      <button
        onClick={() => router.push("/media/grid")}
        className="w-full text-sm text-brand-blue hover:underline text-left mt-2"
      >
        View all media →
      </button>
    </div>
  );
}

