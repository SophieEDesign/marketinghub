"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { InterfacePage, InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { Edit2, Copy, Trash2, Plus, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import PageBuilder from "./PageBuilder";
import PageRenderer from "./PageRenderer";
import BlockMenu, { BlockType } from "@/components/dashboard/blocks/BlockMenu";
import { PageContextProvider } from "./PageContext";
import PageSettingsDrawer from "./PageSettingsDrawer";

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
  const [showSettings, setShowSettings] = useState(false);

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
              {page.page_type && page.page_type !== 'custom' && (
                <Button variant="outline" onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              )}
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
        {/* Use PageRenderer for non-custom pages, PageBuilder for custom pages */}
        {page.page_type && page.page_type !== 'custom' ? (
          <PageRenderer 
            page={page} 
            data={blocks}
            blocks={blocks}
            isEditing={isEditing}
            onAddBlock={async (type: string) => {
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
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: error.message || "Failed to add block",
                  type: "error",
                });
              }
            }}
            onUpdateBlock={async (id: string, updates: Partial<InterfacePageBlock>) => {
              try {
                const response = await fetch(`/api/page-blocks/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updates),
                });
                if (!response.ok) throw new Error("Failed to update block");
                await loadPage();
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: error.message || "Failed to update block",
                  type: "error",
                });
              }
            }}
            onDeleteBlock={async (id: string) => {
              try {
                const response = await fetch(`/api/page-blocks/${id}`, {
                  method: "DELETE",
                });
                if (!response.ok) throw new Error("Failed to delete block");
                await loadPage();
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: error.message || "Failed to delete block",
                  type: "error",
                });
              }
            }}
            onReorderBlocks={async (blockIds: string[]) => {
              const updates = blockIds.map((id, index) => ({
                id,
                position_y: index,
              }));
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
        ) : blocks.length === 0 && !isEditing ? (
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
              onAddBlock={async (type: string) => {
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
                  await loadPage(); // Reload to get fresh data
                  setShowBlockMenu(false);
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to add block",
                    type: "error",
                  });
                }
              }}
              onUpdateBlock={async (id: string, updates: Partial<InterfacePageBlock>) => {
                try {
                  // Update local state optimistically first (like Dashboard does)
                  setBlocks((prev) =>
                    prev.map((b) =>
                      b.id === id
                        ? {
                            ...b,
                            ...updates,
                            // Merge config if it's being updated
                            config:
                              updates.config !== undefined
                                ? { ...b.config, ...updates.config }
                                : b.config,
                          }
                        : b
                    )
                  );

                  const response = await fetch(`/api/page-blocks/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates),
                  });
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || "Failed to update block");
                  }
                  const updated = await response.json();
                  
                  // Update with server response to ensure consistency
                  setBlocks((prev) =>
                    prev.map((b) => (b.id === id ? updated : b))
                  );
                  
                  // Only show toast for non-layout updates (content changes)
                  if (updates.config !== undefined) {
                  toast({
                    title: "Success",
                    description: "Block settings saved",
                    type: "success",
                  });
                  }
                } catch (error: any) {
                  console.error("Error updating block:", error);
                  // Revert optimistic update on error
                  loadPage();
                  toast({
                    title: "Error",
                    description: error.message || "Failed to update block",
                    type: "error",
                  });
                }
              }}
              onDeleteBlock={async (id: string) => {
                try {
                  const response = await fetch(`/api/page-blocks/${id}`, {
                    method: "DELETE",
                  });
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || "Failed to delete block");
                  }
                  // Reload the page to ensure UI is in sync
                  await loadPage();
                  toast({
                    title: "Success",
                    description: "Block deleted successfully",
                    type: "success",
                  });
                } catch (error: any) {
                  console.error("Error deleting block:", error);
                  toast({
                    title: "Error",
                    description: error.message || "Failed to delete block",
                    type: "error",
                  });
                }
              }}
              onReorderBlocks={async (blockIds: string[]) => {
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowBlockMenu(false)}>
          <div
            className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <BlockMenu
              onSelectBlockType={async (type: BlockType) => {
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
          </div>
        </div>
      )}

      {/* Page Settings Drawer */}
      <PageSettingsDrawer
        page={page}
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

