"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function Sheet({ open, onOpenChange, children, side = "right", className = "" }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Sheet */}
      <div
        className={`fixed inset-y-0 z-50 bg-white dark:bg-gray-950 shadow-xl border-l border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-out overflow-y-auto ${
          side === "right" ? "right-0" : "left-0"
        } w-full md:w-[600px] lg:w-[700px] ${className}`}
      >
        {children}
      </div>
    </>
  );
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function SheetContent({ children, className = "", onClose }: SheetContentProps) {
  return (
    <div className={`h-full ${className}`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      {children}
    </div>
  );
}

