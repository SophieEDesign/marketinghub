"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical } from "lucide-react";

interface ResizableHeaderProps {
  id: string;
  label: string;
  width?: number;
  minWidth?: number;
  onResize: (id: string, width: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  children?: React.ReactNode;
  showMenu?: boolean;
  onMenuClick?: () => void;
}

export default function ResizableHeader({
  id,
  label,
  width,
  minWidth = 100,
  onResize,
  onDragStart,
  onDragEnd,
  isDragging = false,
  children,
  showMenu = false,
  onMenuClick,
}: ResizableHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(width || 150);
  const headerRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    if (width !== undefined) {
      setCurrentWidth(width);
    }
  }, [width]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Check if clicking on resize handle
      const target = e.target as HTMLElement;
      if (target.classList.contains("resize-handle")) {
        e.preventDefault();
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = currentWidth;
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      }
    },
    [currentWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + diff);
      setCurrentWidth(newWidth);
      onResize(id, newWidth);
    },
    [isResizing, id, minWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={headerRef as any}
      style={{ width: `${currentWidth}px`, minWidth: `${minWidth}px`, position: "relative" }}
      className={`px-4 py-3 font-heading uppercase text-xs tracking-wide text-brand-grey font-semibold text-left bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 select-none ${
        isDragging ? "opacity-50" : ""
      } ${isResizing ? "cursor-col-resize" : ""}`}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-2">
        {onDragStart && (
          <div
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragStart();
            }}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {children || <span className="truncate">{label}</span>}
        </div>
        {showMenu && onMenuClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick();
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
        className="resize-handle absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity z-10"
        title="Drag to resize"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsResizing(true);
          startXRef.current = e.clientX;
          startWidthRef.current = currentWidth;
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      />
    </div>
  );
}
