"use client";

/**
 * Adapter components to bridge Page Blocks and Dashboard Blocks
 * 
 * These components adapt the page block structure to work with
 * existing dashboard block components.
 */

import React from "react";
import { BlockConfig } from "@/lib/pages/blockTypes";
import TextBlock from "@/components/dashboard/blocks/TextBlock";
import ImageBlock from "@/components/dashboard/blocks/ImageBlock";
import EmbedBlock from "@/components/dashboard/blocks/EmbedBlock";
import KpiBlock from "@/components/dashboard/blocks/KpiBlock";
import TableBlock from "@/components/dashboard/blocks/TableBlock";
import HtmlBlock from "@/components/dashboard/blocks/HtmlBlock";

interface PageBlockAdapterProps {
  block: BlockConfig;
  isEditing: boolean;
  onUpdate?: (id: string, updates: Partial<BlockConfig>) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
}

/**
 * Convert page block config to dashboard block format
 */
function convertToDashboardBlock(block: BlockConfig) {
  return {
    id: block.id,
    type: block.type,
    content: block.settings || {},
    position_x: block.position.x,
    position_y: block.position.y,
    width: block.position.w,
    height: block.position.h,
  };
}

/**
 * Text Block Adapter
 */
export function PageTextBlock({ block, isEditing, onUpdate, onDelete, onOpenSettings }: PageBlockAdapterProps) {
  const dashboardBlock = convertToDashboardBlock(block);
  const hasContent = block.settings?.html || block.settings?.text;
  
  // Show placeholder if no content (only in view mode)
  if (!hasContent && !isEditing) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Click to edit
        </div>
      </div>
    );
  }
  
  return (
    <TextBlock
      id={dashboardBlock.id}
      content={dashboardBlock.content}
      onUpdate={onUpdate ? (id, content) => onUpdate(id, { settings: content }) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
      onOpenSettings={onOpenSettings}
      editing={isEditing}
    />
  );
}

/**
 * Image Block Adapter
 */
export function PageImageBlock({ block, isEditing, onUpdate, onDelete, onOpenSettings }: PageBlockAdapterProps) {
  const dashboardBlock = convertToDashboardBlock(block);
  const hasImage = block.settings?.url;
  
  // Show placeholder if no image
  if (!hasImage && !isEditing) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {block.settings?.title || "Image"}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Upload or paste URL
        </div>
      </div>
    );
  }
  
  return (
    <ImageBlock
      id={dashboardBlock.id}
      content={dashboardBlock.content}
      onUpdate={onUpdate ? (id, content) => onUpdate(id, { settings: content }) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
      onOpenSettings={onOpenSettings}
      editing={isEditing}
    />
  );
}

/**
 * Embed Block Adapter
 */
export function PageEmbedBlock({ block, isEditing, onUpdate, onDelete, onOpenSettings }: PageBlockAdapterProps) {
  const dashboardBlock = convertToDashboardBlock(block);
  
  return (
    <EmbedBlock
      id={dashboardBlock.id}
      content={dashboardBlock.content}
      onUpdate={onUpdate ? (id, content) => onUpdate(id, { settings: content }) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
      onOpenSettings={onOpenSettings}
      editing={isEditing}
    />
  );
}

/**
 * KPI Block Adapter
 */
export function PageKpiBlock({ block, isEditing, onUpdate, onDelete, onOpenSettings }: PageBlockAdapterProps) {
  const dashboardBlock = convertToDashboardBlock(block);
  const hasConfig = block.settings?.table && block.settings?.field;
  
  // Show placeholder if not configured
  if (!hasConfig && !isEditing) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {block.settings?.title || "KPI"}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Pick a table and metric
        </div>
      </div>
    );
  }
  
  return (
    <KpiBlock
      id={dashboardBlock.id}
      content={dashboardBlock.content}
      onUpdate={onUpdate ? (id, content) => onUpdate(id, { settings: content }) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
      onOpenSettings={onOpenSettings}
      editing={isEditing}
    />
  );
}

/**
 * Table Block Adapter
 */
export function PageTableBlock({ block, isEditing, onUpdate, onDelete, onOpenSettings }: PageBlockAdapterProps) {
  const dashboardBlock = convertToDashboardBlock(block);
  const hasConfig = block.settings?.table;
  
  // Show placeholder if not configured
  if (!hasConfig && !isEditing) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {block.settings?.title || "Table"}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Choose table and fields
        </div>
      </div>
    );
  }
  
  return (
    <TableBlock
      id={dashboardBlock.id}
      content={dashboardBlock.content}
      onUpdate={onUpdate ? (id, content) => onUpdate(id, { settings: content }) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
      onOpenSettings={onOpenSettings}
      editing={isEditing}
    />
  );
}

/**
 * HTML Block Adapter
 */
export function PageHtmlBlock({ block, isEditing, onUpdate, onDelete, onOpenSettings }: PageBlockAdapterProps) {
  const dashboardBlock = convertToDashboardBlock(block);
  
  return (
    <HtmlBlock
      id={dashboardBlock.id}
      content={dashboardBlock.content}
      onUpdate={onUpdate ? (id, content) => onUpdate(id, { settings: content }) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
      onOpenSettings={onOpenSettings}
      editing={isEditing}
    />
  );
}
