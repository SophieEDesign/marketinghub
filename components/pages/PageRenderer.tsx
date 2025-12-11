"use client";

/**
 * Central Page Renderer
 * Routes to the appropriate page type renderer based on page.page_type
 * Loads page settings and passes config to renderers
 */

import { useEffect, useState } from "react";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
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

  // Pass config to renderers
  const rendererProps = {
    page,
    config,
    data,
    isEditing,
    ...props,
  };

  switch (pageType) {
    case 'grid':
      return <GridPage {...rendererProps} />;
    
    case 'record':
      return <RecordPage {...rendererProps} />;
    
    case 'kanban':
      return <KanbanPage {...rendererProps} />;
    
    case 'gallery':
      return <GalleryPage {...rendererProps} />;
    
    case 'calendar':
      return <CalendarPage {...rendererProps} />;
    
    case 'form':
      return <FormPage {...rendererProps} />;
    
    case 'chart':
      return <ChartPage {...rendererProps} />;
    
    case 'custom':
    default:
      return <CustomPage page={page} data={data} {...props} />;
  }
}
