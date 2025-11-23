"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { InterfacePage, InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { Edit2, Copy, Trash2, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import PageBuilder from "./PageBuilder";
import BlockMenu from "./BlockMenu";
import { PageContextProvider } from "./PageContext";

interface PageViewProps {
  pageId: string;
  defaultEditing?: boolean;
}

export default function PageView({ pageId, defaultEditing = false }: PageViewProps) {
  const router = useRouter();
  const [page, setPage] = useState<InterfacePage | null>(null);
  const [blocks, setBlocks] = useState<InterfacePageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(defaultEditing);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  useEffect(() => {
    loadPage();
  }, [pageId]);

  const loadPage = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pages/${pageId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Page Not Found",
            description: "This page does not exist",
            type: "error",
          });
          router.push("/");
          return;
        }
        throw new Error("Failed to load page");
      }
      const data = await response.json();
      setPage(data);
      setBlocks(data.blocks || []);
    } catch (error: any) {
      console.error("Error loading page:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load page",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading page...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-500">Page not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {page.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Done Editing
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Page
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {blocks.length === 0 && !isEditing ? (
          <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              This page has no blocks yet.
            </p>
            <Button onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Page
            </Button>
          </div>
        ) : (
          <PageContextProvider>
            {isEditing && (
              <div className="mb-4 flex justify-end">
                <Button onClick={() => setShowBlockMenu(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Block
                </Button>
              </div>
            )}
            <PageBuilder
              pageId={pageId}
              blocks={blocks}
              isEditing={isEditing}
              onAddBlock={async (type) => {
                try {
                  const response = await fetch("/api/page-blocks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      page_id: pageId,
                      type,
                      position_x: 0,
                      position_y: blocks.length,
                      width: 12,
                      height: 6,
                      config: {},
                    }),
                  });
                  if (!response.ok) throw new Error("Failed to create block");
                  const newBlock = await response.json();
                  setBlocks([...blocks, newBlock]);
                  setShowBlockMenu(false);
                  await loadPage(); // Reload to get fresh data
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to add block",
                    type: "error",
                  });
                }
              }}
              onUpdateBlock={async (id, updates) => {
                try {
                  const response = await fetch(`/api/page-blocks/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates),
                  });
                  if (!response.ok) throw new Error("Failed to update block");
                  const updated = await response.json();
                  setBlocks(blocks.map((b) => (b.id === id ? updated : b)));
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to update block",
                    type: "error",
                  });
                }
              }}
              onDeleteBlock={async (id) => {
                try {
                  const response = await fetch(`/api/page-blocks/${id}`, {
                    method: "DELETE",
                  });
                  if (!response.ok) throw new Error("Failed to delete block");
                  setBlocks(blocks.filter((b) => b.id !== id));
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to delete block",
                    type: "error",
                  });
                }
              }}
              onReorderBlocks={async (blockIds) => {
                // Update positions based on new order
                const updates = blockIds.map((id, index) => ({
                  id,
                  position_y: index,
                }));
                // TODO: Batch update positions
                for (const update of updates) {
                  await fetch(`/api/page-blocks/${update.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ position_y: update.position_y }),
                  });
                }
                await loadPage();
              }}
            />
          </PageContextProvider>
        )}
      </div>

      {/* Block Menu */}
      {showBlockMenu && (
        <BlockMenu
          onClose={() => setShowBlockMenu(false)}
          onSelect={async (type) => {
            try {
              const response = await fetch("/api/page-blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  page_id: pageId,
                  type,
                  position_x: 0,
                  position_y: blocks.length,
                  width: 12,
                  height: 6,
                  config: {},
                }),
              });
              if (!response.ok) throw new Error("Failed to create block");
              await loadPage();
              setShowBlockMenu(false);
            } catch (error: any) {
              toast({
                title: "Error",
                description: error.message || "Failed to add block",
                type: "error",
              });
            }
          }}
        />
      )}
    </div>
  );
}

