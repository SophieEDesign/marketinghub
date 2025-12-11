"use client";

/**
 * Central Page Renderer
 * Routes to the appropriate page type renderer based on page.page_type
 */

import { InterfacePage } from "@/lib/hooks/useInterfacePages";
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
  [key: string]: any;
}

export default function PageRenderer({ page, data, ...props }: PageRendererProps) {
  if (!page) {
    return (
      <div className="p-6 text-gray-500">
        Page not found
      </div>
    );
  }

  const pageType = page.page_type || 'custom';

  switch (pageType) {
    case 'grid':
      return <GridPage page={page} data={data} {...props} />;
    
    case 'record':
      return <RecordPage page={page} data={data} {...props} />;
    
    case 'kanban':
      return <KanbanPage page={page} data={data} {...props} />;
    
    case 'gallery':
      return <GalleryPage page={page} data={data} {...props} />;
    
    case 'calendar':
      return <CalendarPage page={page} data={data} {...props} />;
    
    case 'form':
      return <FormPage page={page} data={data} {...props} />;
    
    case 'chart':
      return <ChartPage page={page} data={data} {...props} />;
    
    case 'custom':
    default:
      return <CustomPage page={page} data={data} {...props} />;
  }
}
