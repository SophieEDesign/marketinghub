"use client";

import { useState, useRef, useEffect } from "react";
import { PageAction, shouldShowAction } from "@/lib/pages/pageActions";
import { executePageAction, ActionContext } from "@/lib/pages/executePageAction";
import { MoreVertical, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";

interface RecordActionsMenuProps {
  actions: PageAction[];
  record: Record<string, any>;
  context?: ActionContext;
  onActionComplete?: (result: { success: boolean; error?: string }) => void;
  onRecordUpdate?: (recordId: string, updates: Record<string, any>) => Promise<void>;
}

// Icon mapping
const getIcon = (iconName?: string) => {
  if (!iconName) return Icons.MoreVertical;
  const Icon = (Icons as any)[iconName];
  return Icon || Icons.MoreVertical;
};

export default function RecordActionsMenu({
  actions,
  record,
  context,
  onActionComplete,
  onRecordUpdate,
}: RecordActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [executing, setExecuting] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter to record-level actions only
  const recordActions = actions.filter(a => a.scope === "record");

  // Filter by visibility conditions
  const visibleActions = recordActions.filter(a => shouldShowAction(a, record));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (visibleActions.length === 0) return null;

  const handleAction = async (action: PageAction) => {
    setOpen(false);

    // Check confirmation
    if (action.requiresConfirmation) {
      const message = action.confirmationMessage || `Are you sure you want to ${action.label}?`;
      if (!confirm(message)) return;
    }

    setExecuting(prev => new Set(prev).add(action.id));

    try {
      const actionContext: ActionContext = {
        ...context,
        record,
        router,
        onRecordUpdate,
        onNavigate: (path: string) => router.push(path),
        onCopyToClipboard: async (text: string) => {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
          }
        },
      };

      const result = await executePageAction(action, actionContext);
      
      if (onActionComplete) {
        onActionComplete(result);
      }

      if (!result.success && result.error) {
        alert(`Action failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Error executing action:", error);
      if (onActionComplete) {
        onActionComplete({ success: false, error: error.message });
      }
      alert(`Error: ${error.message}`);
    } finally {
      setExecuting(prev => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        disabled={executing.size > 0}
      >
        {executing.size > 0 ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreVertical className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
          <div className="py-1">
            {visibleActions.map((action) => {
              const Icon = getIcon(action.icon);
              const isExecuting = executing.has(action.id);
              
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  disabled={isExecuting}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Icon className="w-4 h-4" />
                      {action.label}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
