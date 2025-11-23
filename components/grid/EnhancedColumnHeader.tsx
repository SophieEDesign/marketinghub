"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ResizableHeader from "./ResizableHeader";
import ColumnMenu from "./ColumnMenu";
import { Field } from "@/lib/fields";

interface EnhancedColumnHeaderProps {
  field: Field;
  width?: number;
  isMobile?: boolean;
  onResize: (fieldId: string, width: number) => void;
  onHide: (fieldId: string) => void;
  onRename: (fieldId: string, newName: string) => void;
  onMoveLeft?: (fieldId: string) => void;
  onMoveRight?: (fieldId: string) => void;
  onResetWidth?: (fieldId: string) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function EnhancedColumnHeader({
  field,
  width,
  isMobile = false,
  onResize,
  onHide,
  onRename,
  onMoveLeft,
  onMoveRight,
  onResetWidth,
  canMoveLeft = true,
  canMoveRight = true,
  isFirst = false,
  isLast = false,
}: EnhancedColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };


  if (isMobile) {
    return (
      <th className="px-4 py-3 font-heading uppercase text-xs tracking-wide text-brand-grey font-semibold text-left">
        {field.label}
      </th>
    );
  }

  return (
    <>
      <th
        ref={setNodeRef}
        data-field-id={field.id}
        style={{
          ...style,
          width: width ? `${width}px` : undefined,
          minWidth: width ? `${width}px` : '100px',
          position: "relative",
        }}
        className={`group relative px-4 py-3 font-heading uppercase text-xs tracking-wide text-brand-grey font-semibold text-left bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 ${
          isDragging
            ? "opacity-50 ring-2 ring-blue-400 rounded-md bg-white dark:bg-gray-800 shadow-md z-50 scale-105"
            : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none flex-1 min-w-0"
          >
            <span className="truncate">{field.label}</span>
          </div>
          {showMenu && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const thElement = document.querySelector(`th[data-field-id="${field.id}"]`) as HTMLElement;
                if (thElement) {
                  const rect = thElement.getBoundingClientRect();
                  setMenuPosition({
                    x: rect.right - 200,
                    y: rect.bottom + 4,
                  });
                  setMenuOpen(true);
                }
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              title="Column options"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          )}
        </div>
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity z-10"
          title="Drag to resize"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            let startX = e.clientX;
            let startWidth = width || 150;
            const minWidth = 100;

            const handleMouseMove = (e: MouseEvent) => {
              const diff = e.clientX - startX;
              const newWidth = Math.max(minWidth, startWidth + diff);
              onResize(field.id, newWidth);
            };

            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
        />
      </th>
      {menuOpen && (
        <ColumnMenu
          fieldId={field.id}
          fieldLabel={field.label}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          position={menuPosition}
          onHide={() => {
            onHide(field.id);
            setMenuOpen(false);
          }}
          onRename={(newName) => {
            onRename(field.id, newName);
            setMenuOpen(false);
          }}
          onMoveLeft={
            onMoveLeft && canMoveLeft
              ? () => {
                  onMoveLeft(field.id);
                  setMenuOpen(false);
                }
              : undefined
          }
          onMoveRight={
            onMoveRight && canMoveRight
              ? () => {
                  onMoveRight(field.id);
                  setMenuOpen(false);
                }
              : undefined
          }
          onResetWidth={
            onResetWidth
              ? () => {
                  onResetWidth(field.id);
                  setMenuOpen(false);
                }
              : undefined
          }
          canMoveLeft={canMoveLeft && !isFirst}
          canMoveRight={canMoveRight && !isLast}
        />
      )}
    </>
  );
}

