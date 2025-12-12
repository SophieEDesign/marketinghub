"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PageAction, QuickAutomation } from "@/lib/pages/pageActions";

interface UsePageActionsOptions {
  pageId: string;
}

export function usePageActions({ pageId }: UsePageActionsOptions) {
  const [actions, setActions] = useState<PageAction[]>([]);
  const [quickAutomations, setQuickAutomations] = useState<QuickAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: page, error: fetchError } = await supabase
        .from("pages")
        .select("actions, quick_automations")
        .eq("id", pageId)
        .single();

      if (fetchError) throw fetchError;

      setActions((page?.actions as PageAction[]) || []);
      setQuickAutomations((page?.quick_automations as QuickAutomation[]) || []);
    } catch (err: any) {
      console.error("Error loading page actions:", err);
      setError(err.message || "Failed to load page actions");
      setActions([]);
      setQuickAutomations([]);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const saveActions = useCallback(async (newActions: PageAction[]) => {
    if (!pageId) return;

    try {
      setError(null);

      const response = await fetch(`/api/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: newActions }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save page actions");
      }

      setActions(newActions);
      return newActions;
    } catch (err: any) {
      console.error("Error saving page actions:", err);
      setError(err.message || "Failed to save page actions");
      throw err;
    }
  }, [pageId]);

  const saveQuickAutomations = useCallback(async (newAutomations: QuickAutomation[]) => {
    if (!pageId) return;

    try {
      setError(null);

      const response = await fetch(`/api/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quick_automations: newAutomations }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save quick automations");
      }

      setQuickAutomations(newAutomations);
      return newAutomations;
    } catch (err: any) {
      console.error("Error saving quick automations:", err);
      setError(err.message || "Failed to save quick automations");
      throw err;
    }
  }, [pageId]);

  return {
    actions,
    quickAutomations,
    loading,
    error,
    loadActions,
    saveActions,
    saveQuickAutomations,
  };
}
