"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PageConfig } from "@/lib/pages/pageConfig";
import { getDefaultTemplate } from "@/lib/pages/defaultTemplates";

interface UsePageConfigOptions {
  pageId: string;
  pageType: string;
}

export function usePageConfig({ pageId, pageType }: UsePageConfigOptions) {
  const [config, setConfig] = useState<PageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: page, error: fetchError } = await supabase
        .from("pages")
        .select("settings")
        .eq("id", pageId)
        .single();

      if (fetchError) throw fetchError;

      // Get default template for this page type
      const defaultTemplate = getDefaultTemplate(pageType);
      
      // Merge page settings with defaults
      const pageSettings = page?.settings || {};
      const mergedConfig = {
        ...defaultTemplate.settings,
        ...pageSettings,
      } as PageConfig;

      setConfig(mergedConfig);
    } catch (err: any) {
      console.error("Error loading page config:", err);
      setError(err.message || "Failed to load page config");
      // Set default config on error
      const defaultTemplate = getDefaultTemplate(pageType);
      setConfig(defaultTemplate.settings as PageConfig);
    } finally {
      setLoading(false);
    }
  }, [pageId, pageType]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = useCallback(async (updates: Partial<PageConfig>) => {
    if (!pageId) return;

    try {
      setError(null);

      // Merge updates with current config
      const newConfig = {
        ...config,
        ...updates,
      } as PageConfig;

      // Use API route to save settings
      const response = await fetch(`/api/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newConfig }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save page config");
      }

      setConfig(newConfig);
      return newConfig;
    } catch (err: any) {
      console.error("Error saving page config:", err);
      setError(err.message || "Failed to save page config");
      throw err;
    }
  }, [pageId, config]);

  const validateConfig = useCallback((configToValidate: PageConfig | null): string[] => {
    const errors: string[] = [];

    if (!configToValidate) {
      errors.push("Configuration is required");
      return errors;
    }

    if (!configToValidate.table) {
      errors.push("Table is required");
    }

    // Type-specific validation
    if (pageType === "grid" && !Array.isArray((configToValidate as any).fields)) {
      errors.push("Grid page requires fields array");
    }

    if (pageType === "kanban" && !(configToValidate as any).groupField) {
      errors.push("Kanban page requires groupField");
    }

    if (pageType === "gallery" && !(configToValidate as any).imageField) {
      errors.push("Gallery page requires imageField");
    }

    if (pageType === "calendar" && !(configToValidate as any).dateField) {
      errors.push("Calendar page requires dateField");
    }

    if (pageType === "chart") {
      if (!(configToValidate as any).xField) errors.push("Chart page requires xField");
      if (!(configToValidate as any).yField) errors.push("Chart page requires yField");
    }

    return errors;
  }, [pageType]);

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    validateConfig,
  };
}
