"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Image } from "lucide-react";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";

interface Asset {
  id: string;
  filename?: string;
  asset_type?: string;
  content_id?: string;
}

export default function AssetsList() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openRecord } = useRecordDrawer();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("assets")
        .select("id, filename, asset_type, content_id")
        .order("created_at", { ascending: false })
        .limit(6);

      if (data) {
        setAssets(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading assets...</div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No assets. <button onClick={() => router.push("/assets/grid")} className="text-brand-blue hover:underline">View all</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {assets.map((item) => (
        <button
          key={item.id}
          onClick={() => openRecord("assets", item.id)}
          className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Image className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{item.filename || `Asset ${item.id.slice(0, 8)}`}</div>
            {item.asset_type && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.asset_type}</div>
            )}
          </div>
        </button>
      ))}
      <button
        onClick={() => router.push("/assets/grid")}
        className="w-full text-sm text-brand-blue hover:underline text-left mt-2"
      >
        View all assets →
      </button>
    </div>
  );
}

