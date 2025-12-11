"use client";

/**
 * Central Page Renderer
 * Routes to the appropriate page type renderer based on page.page_type
 * Loads page settings and passes config to renderers
 */

import { useEffect, useState } from "react";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import {
  GridPageConfig,
  RecordPageConfig,
  KanbanPageConfig,
  GalleryPageConfig,
  CalendarPageConfig,
  FormPageConfig,
  ChartPageConfig,
} from "@/lib/pages/pageConfig";
import GridPage from "./renderers/GridPage";
import RecordPage from "./renderers/RecordPage";
import KanbanPage from "./renderers/KanbanPage";
import GalleryPage from "./renderers/GalleryPage";
import CalendarPage from "./renderers/CalendarPage";
import FormPage from "./renderers/FormPage";
import ChartPage from "./renderers/ChartPage";
import CustomPage from "./renderers/CustomPage";

interface PageRendererProps {
  page: InterfacePage;
  data?: any;
  isEditing?: boolean;
  [key: string]: any;
}

export default function PageRenderer({ page, data, isEditing, ...props }: PageRendererProps) {
  const pageType = page?.page_type || 'custom';
  const { config, loading: configLoading } = usePageConfig({
    pageId: page?.id || '',
    pageType,
  });

  if (!page) {
    return (
      <div className="p-6 text-gray-500">
        Page not found
      </div>
    );
  }

  if (configLoading && pageType !== 'custom') {
    return (
      <div className="p-6 text-gray-500">
        Loading page configuration...
      </div>
    );
  }

  // Base props for all renderers
  const baseProps = {
    page,
    data,
    isEditing,
    ...props,
  };

  switch (pageType) {
    case 'grid':
      return <GridPage {...baseProps} config={config as GridPageConfig | null} />;
    
    case 'record':
      return <RecordPage {...baseProps} config={config as RecordPageConfig | null} />;
    
    case 'kanban':
      return <KanbanPage {...baseProps} config={config as KanbanPageConfig | null} />;
    
    case 'gallery':
      return <GalleryPage {...baseProps} config={config as GalleryPageConfig | null} />;
    
    case 'calendar':
      return <CalendarPage {...baseProps} config={config as CalendarPageConfig | null} />;
    
    case 'form':
      return <FormPage {...baseProps} config={config as FormPageConfig | null} />;
    
    case 'chart':
      return <ChartPage {...baseProps} config={config as ChartPageConfig | null} />;
    
    case 'custom':
    default:
      return <CustomPage page={page} data={data} {...props} />;
  }
}
