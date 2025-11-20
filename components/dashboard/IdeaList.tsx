"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import { useModal } from "@/lib/modalState";
import { runAutomations } from "@/lib/automations/automationEngine";
import { toast } from "../ui/Toast";
import { Lightbulb, Plus } from "lucide-react";

interface Idea {
  id: string;
  title: string;
  status: string;
  category: string | null;
}

export default function IdeaList() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const { openRecord } = useRecordDrawer();
  const { setOpen: setModalOpen, setTableId: setModalTableId } = useModal();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("ideas")
        .select("id, title, status, category")
        .in("status", ["Idea", "idea", "Draft", "draft", "Ready", "ready", "Ready to Create"])
        .order("created_at", { ascending: false })
        .limit(6);

      if (data) {
        setIdeas(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  const handleIdeaClick = (ideaId: string) => {
    openRecord("ideas", ideaId);
  };

  const handleConvertToContent = async (idea: Idea) => {
    // Update idea status to trigger automation
    const { data: updatedIdea, error } = await supabase
      .from("ideas")
      .update({ status: "Ready to Create" })
      .eq("id", idea.id)
      .select()
      .single();

    if (error || !updatedIdea) {
      toast({
        title: "Error",
        description: "Failed to convert idea",
        type: "error",
      });
      return;
    }

    // Run automations to create content
    try {
      const automationResult = await runAutomations("ideas", updatedIdea, idea);
      
      if (automationResult.createdRecords.length > 0) {
        toast({
          title: "Success",
          description: `Content created from idea: "${idea.title}"`,
          type: "success",
        });
        
        // Reload ideas list
        const { data: refreshed } = await supabase
          .from("ideas")
          .select("id, title, status, category")
          .in("status", ["Idea", "idea", "Draft", "draft", "Ready", "ready", "Ready to Create"])
          .order("created_at", { ascending: false })
          .limit(6);
        
        if (refreshed) {
          setIdeas(refreshed);
        }
      }
    } catch (error) {
      console.error("Error converting idea:", error);
      toast({
        title: "Error",
        description: "Failed to convert idea to content",
        type: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-heading text-brand-blue mb-4">Recent Ideas</h2>
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading text-brand-blue">Recent Ideas</h2>
        <button
          onClick={() => {
            setModalTableId("ideas");
            setModalOpen(true);
          }}
          className="btn-secondary text-xs flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>
      <div className="space-y-2">
        {ideas.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-sm">No ideas yet</div>
        ) : (
          ideas.map((idea) => (
            <div
              key={idea.id}
              className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleIdeaClick(idea.id)}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {idea.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {idea.status} {idea.category && `• ${idea.category}`}
                    </div>
                  </div>
                </div>
              </div>
              {(idea.status === "Ready" || idea.status === "ready" || idea.status === "Ready to Create") && (
                <button
                  onClick={() => handleConvertToContent(idea)}
                  className="btn-primary text-xs ml-2 flex-shrink-0"
                >
                  Convert
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

