"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Layout, Edit2, Trash2, Eye } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import NewPageModal from "@/components/pages/NewPageModal";

interface Page {
  id: string;
  name: string;
  layout: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export default function PagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pages");
      if (!response.ok) throw new Error("Failed to load pages");
      const data = await response.json();
      setPages(data);
    } catch (error: any) {
      console.error("Error loading pages:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load pages",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async (name: string, layout: string) => {
    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          layout,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create page");
      }

      await loadPages();
      const newPage = await response.json();
      toast({
        title: "Success",
        description: "Page created successfully",
        type: "success",
      });
      
      // Navigate to edit the new page
      router.push(`/pages/${newPage.id}/edit`);
    } catch (error: any) {
      console.error("Error creating page:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create page",
        type: "error",
      });
      throw error;
    }
  };

  const handleDeletePage = async (id: string, name: string) => {
    if (!confirm(`Delete page "${name}"? This will also delete all blocks.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/pages/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete page");
      }

      setPages(pages.filter((p) => p.id !== id));
      toast({
        title: "Success",
        description: "Page deleted successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error deleting page:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete page",
        type: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading pages...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Pages</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Create and manage interface pages
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Page
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {pages.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
            <Layout className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No pages yet. Create your first page to get started.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Page
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((page) => (
              <div
                key={page.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <Layout className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {page.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {page.layout} layout
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/pages/${page.id}/view`)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/pages/${page.id}/edit`)}
                    className="flex-1"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePage(page.id, page.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                    title="Delete page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <NewPageModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePage}
        />
      )}
    </div>
  );
}

