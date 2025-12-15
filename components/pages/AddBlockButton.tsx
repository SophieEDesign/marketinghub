"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { getAllBlockTypes, getBlockTypesByCategory, createBlock } from "@/lib/pages/blockTypes";
import { BlockConfig } from "@/lib/pages/blockTypes";
import Button from "@/components/ui/Button";

interface AddBlockButtonProps {
  onAddBlock: (block: BlockConfig) => void;
  existingBlocks?: BlockConfig[];
}

export default function AddBlockButton({ onAddBlock, existingBlocks = [] }: AddBlockButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const allBlockTypes = getAllBlockTypes();
  const categories = [
    { id: "data", label: "Data" },
    { id: "content", label: "Content" },
    { id: "layout", label: "Layout" },
    { id: "automation", label: "Automation" },
  ] as const;

  // Calculate next position (below existing blocks)
  const getNextPosition = () => {
    if (existingBlocks.length === 0) {
      return { x: 0, y: 0 };
    }

    // Find the bottom-most block
    let maxY = 0;
    let maxHeight = 0;
    existingBlocks.forEach((block) => {
      const bottom = block.position.y + block.position.h;
      if (bottom > maxY) {
        maxY = bottom;
        maxHeight = block.position.h;
      }
    });

    return { x: 0, y: maxY };
  };

  const handleSelectBlock = (blockTypeId: string) => {
    const position = getNextPosition();
    const newBlock = createBlock(blockTypeId, position);
    onAddBlock(newBlock);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Block
        <ChevronDown className="w-4 h-4" />
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-[600px] overflow-y-auto">
            <div className="p-2">
              {categories.map((category) => {
                const categoryBlocks = getBlockTypesByCategory(category.id as any);
                if (categoryBlocks.length === 0) return null;

                return (
                  <div key={category.id} className="mb-4 last:mb-0">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {category.label}
                    </div>
                    <div className="space-y-1">
                      {categoryBlocks.map((blockType) => {
                        const Icon = blockType.icon;
                        return (
                          <button
                            key={blockType.id}
                            onClick={() => handleSelectBlock(blockType.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                          >
                            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {blockType.label}
                              </div>
                              {blockType.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {blockType.description}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
