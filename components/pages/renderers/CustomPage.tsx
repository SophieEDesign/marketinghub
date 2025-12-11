"use client";

import PageBuilder from "../PageBuilder";
import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";

interface CustomPageProps {
  page: any;
  data?: any;
  blocks?: InterfacePageBlock[];
  isEditing?: boolean;
  onAddBlock?: (type: string) => void;
  onUpdateBlock?: (id: string, updates: Partial<InterfacePageBlock>) => void;
  onDeleteBlock?: (id: string) => void;
  onReorderBlocks?: (blockIds: string[]) => void;
  [key: string]: any;
}

export default function CustomPage(props: CustomPageProps) {
  // For custom pages, use the existing PageBuilder component
  // This maintains backward compatibility with the existing block-based system
  if (props.blocks && props.page) {
    return (
      <PageBuilder
        pageId={props.page.id}
        blocks={props.blocks || []}
        isEditing={props.isEditing || false}
        onAddBlock={props.onAddBlock || (() => {})}
        onUpdateBlock={props.onUpdateBlock || (() => {})}
        onDeleteBlock={props.onDeleteBlock || (() => {})}
        onReorderBlocks={props.onReorderBlocks || (() => {})}
      />
    );
  }

  return (
    <div className="p-6 text-gray-500">
      Custom Page page type placeholder
    </div>
  );
}
