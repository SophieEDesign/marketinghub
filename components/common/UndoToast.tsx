"use client";

import { useEffect, useState } from "react";
import { Undo, X } from "lucide-react";
import { UndoAction } from "@/lib/undo/useUndo";

interface UndoToastProps {
  action: UndoAction | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoToast({ action, onUndo, onDismiss }: UndoToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (action) {
      setVisible(true);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Wait for animation
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [action, onDismiss]);

  if (!action || !visible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg p-4 min-w-[300px] max-w-md transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">{action.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onUndo();
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Undo className="w-4 h-4" />
            Undo
          </button>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

