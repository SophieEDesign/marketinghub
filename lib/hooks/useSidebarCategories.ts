"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface SidebarCategory {
  id: string;
  name: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface SidebarItem {
  id: string;
  category_id: string;
  item_type: "page" | "table" | "link";
  item_id: string | null;
  label: string;
  href: string;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface SidebarCategoryWithItems extends SidebarCategory {
  items: SidebarItem[];
}

export function useSidebarCategories() {
  const [categories, setCategories] = useState<SidebarCategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("sidebar_categories")
        .select("*")
        .order("position", { ascending: true });

      if (categoriesError) throw categoriesError;

      // Load items
      const { data: itemsData, error: itemsError } = await supabase
        .from("sidebar_items")
        .select("*")
        .order("position", { ascending: true });

      if (itemsError) throw itemsError;

      // Group items by category
      const categoriesWithItems: SidebarCategoryWithItems[] = (categoriesData || []).map((category) => ({
        ...category,
        items: (itemsData || []).filter((item) => item.category_id === category.id),
      }));

      setCategories(categoriesWithItems);
    } catch (err: any) {
      console.error("Error loading sidebar categories:", err);
      setError(err.message || "Failed to load sidebar categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const createCategory = useCallback(
    async (name: string, icon: string = "folder") => {
      try {
        // Get max position
        const { data: maxCategory } = await supabase
          .from("sidebar_categories")
          .select("position")
          .order("position", { ascending: false })
          .limit(1)
          .single();

        const position = maxCategory?.position !== undefined ? maxCategory.position + 1 : 0;

        const { data, error } = await supabase
          .from("sidebar_categories")
          .insert({ name, icon, position })
          .select()
          .single();

        if (error) throw error;
        await loadCategories();
        return data;
      } catch (err: any) {
        console.error("Error creating category:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<SidebarCategory>) => {
      try {
        const { error } = await supabase
          .from("sidebar_categories")
          .update(updates)
          .eq("id", id);

        if (error) throw error;
        await loadCategories();
      } catch (err: any) {
        console.error("Error updating category:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("sidebar_categories").delete().eq("id", id);

        if (error) throw error;
        await loadCategories();
      } catch (err: any) {
        console.error("Error deleting category:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const reorderCategories = useCallback(
    async (categoryIds: string[]) => {
      try {
        const updates = categoryIds.map((id, index) => ({
          id,
          position: index,
        }));

        for (const update of updates) {
          const { error } = await supabase
            .from("sidebar_categories")
            .update({ position: update.position })
            .eq("id", update.id);

          if (error) throw error;
        }

        await loadCategories();
      } catch (err: any) {
        console.error("Error reordering categories:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const addItem = useCallback(
    async (
      categoryId: string,
      itemType: "page" | "table" | "link",
      itemId: string | null,
      label: string,
      href: string,
      icon: string | null = null
    ) => {
      try {
        // Get max position in category
        const { data: maxItem } = await supabase
          .from("sidebar_items")
          .select("position")
          .eq("category_id", categoryId)
          .order("position", { ascending: false })
          .limit(1)
          .single();

        const position = maxItem?.position !== undefined ? maxItem.position + 1 : 0;

        const { data, error } = await supabase
          .from("sidebar_items")
          .insert({
            category_id: categoryId,
            item_type: itemType,
            item_id: itemId,
            label,
            href,
            icon,
            position,
          })
          .select()
          .single();

        if (error) throw error;
        await loadCategories();
        return data;
      } catch (err: any) {
        console.error("Error adding item:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<SidebarItem>) => {
      try {
        const { error } = await supabase.from("sidebar_items").update(updates).eq("id", id);

        if (error) throw error;
        await loadCategories();
      } catch (err: any) {
        console.error("Error updating item:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("sidebar_items").delete().eq("id", id);

        if (error) throw error;
        await loadCategories();
      } catch (err: any) {
        console.error("Error deleting item:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const reorderItems = useCallback(
    async (categoryId: string, itemIds: string[]) => {
      try {
        const updates = itemIds.map((id, index) => ({
          id,
          position: index,
        }));

        for (const update of updates) {
          const { error } = await supabase
            .from("sidebar_items")
            .update({ position: update.position })
            .eq("id", update.id)
            .eq("category_id", categoryId);

          if (error) throw error;
        }

        await loadCategories();
      } catch (err: any) {
        console.error("Error reordering items:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  const moveItem = useCallback(
    async (itemId: string, newCategoryId: string, newPosition: number) => {
      try {
        const { error } = await supabase
          .from("sidebar_items")
          .update({ category_id: newCategoryId, position: newPosition })
          .eq("id", itemId);

        if (error) throw error;
        await loadCategories();
      } catch (err: any) {
        console.error("Error moving item:", err);
        throw err;
      }
    },
    [loadCategories]
  );

  return {
    categories,
    loading,
    error,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    moveItem,
  };
}

