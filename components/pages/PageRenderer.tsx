"use client";

/**
 * Central Page Renderer
 * Routes to the appropriate page type renderer based on page.page_type
 * Loads page settings and passes config to renderers
 */

import { useState, useCallback } from "react";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import { usePageActions } from "@/lib/hooks/usePageActions";
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
import PageActionsBar from "./PageActionsBar";
import PageGridLayout from "./PageGridLayout";
import PageBlockSettingsPane from "./PageBlockSettingsPane";
import { BlockConfig } from "@/lib/pages/blockTypes";

interface PageRendererProps {
  page: InterfacePage;
  data?: any;
  isEditing?: boolean;
  onPageUpdate?: (updates: Partial<InterfacePage>) => void;
  recordContext?: Record<string, any>; // For block visibility evaluation
  userRole?: string; // For block permission checks
  [key: string]: any;
}

export default function PageRenderer({ 
  page, 
  data, 
  isEditing, 
  onPageUpdate,
  recordContext,
  userRole,
  ...props 
}: PageRendererProps) {
  const pageType = page?.page_type || 'custom';
  const { config, loading: configLoading } = usePageConfig({
    pageId: page?.id || '',
    pageType,
  });
  const { actions } = usePageActions({ pageId: page?.id || '' });
  
  // Get blocks from page (with backward compatibility)
  const blocks: BlockConfig[] = page.blocks || [];
  const [selectedBlock, setSelectedBlock] = useState<BlockConfig | null>(null);
  const [isBlockSettingsOpen, setIsBlockSettingsOpen] = useState(false);

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

  // Handle blocks update
  const handleBlocksChange = useCallback((updatedBlocks: BlockConfig[]) => {
    if (onPageUpdate) {
      onPageUpdate({ blocks: updatedBlocks });
    }
  }, [onPageUpdate]);

  // Handle block update
  const handleBlockUpdate = useCallback((id: string, updates: Partial<BlockConfig>) => {
    const updatedBlocks = blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    );
    handleBlocksChange(updatedBlocks);
  }, [blocks, handleBlocksChange]);

  // Handle block delete
  const handleBlockDelete = useCallback((id: string) => {
    const updatedBlocks = blocks.filter(block => block.id !== id);
    handleBlocksChange(updatedBlocks);
  }, [blocks, handleBlocksChange]);

  // Handle block duplicate
  const handleBlockDuplicate = useCallback((block: BlockConfig) => {
    const newBlock: BlockConfig = {
      ...block,
      id: crypto.randomUUID(),
      position: {
        ...block.position,
        y: block.position.y + block.position.h, // Place below original
      },
    };
    handleBlocksChange([...blocks, newBlock]);
  }, [blocks, handleBlocksChange]);

  // Handle block settings
  const handleBlockSettings = useCallback((block: BlockConfig) => {
    setSelectedBlock(block);
    setIsBlockSettingsOpen(true);
  }, []);

  // Base props for all renderers
  const baseProps = {
    page,
    data,
    isEditing,
    actions, // Pass actions to renderers
    ...props,
  };

  const renderPage = () => {
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
  };

  return (
    <div className="flex flex-col gap-4">
      <PageActionsBar 
        actions={actions} 
        context={{
          pageId: page.id,
          record: recordContext,
        }}
      />
      {renderPage()}
      
      {/* Composable Blocks Layout */}
      {blocks && blocks.length > 0 && (
        <div className="mt-8">
          <PageGridLayout
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
            editMode={isEditing || false}
            recordContext={recordContext}
            userRole={userRole}
            onBlockUpdate={handleBlockUpdate}
            onBlockDelete={handleBlockDelete}
            onBlockSettings={handleBlockSettings}
            onBlockDuplicate={handleBlockDuplicate}
          />
        </div>
      )}
      
      {/* Block Settings Pane */}
      {isBlockSettingsOpen && selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <PageBlockSettingsPane
              block={selectedBlock}
              onUpdate={(updates) => handleBlockUpdate(selectedBlock.id, updates)}
              onDelete={() => handleBlockDelete(selectedBlock.id)}
              onClose={() => setIsBlockSettingsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
