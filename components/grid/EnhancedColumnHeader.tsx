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
        style={style}
        className={`group relative ${
          isDragging
            ? "opacity-50 ring-2 ring-blue-400 rounded-md bg-white dark:bg-gray-800 shadow-md z-50 scale-105"
            : ""
        }`}
      >
        <ResizableHeader
          id={field.id}
          label={field.label}
          width={width}
          minWidth={100}
          onResize={onResize}
          onDragStart={() => {}}
          isDragging={isDragging}
          showMenu={true}
          onMenuClick={() => {
            // Get position from the th element
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
        >
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
          >
            <span>{field.label}</span>
          </div>
        </ResizableHeader>
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

