"use client";

import { useState } from "react";
import { PageAction, shouldShowAction, ActionContext } from "@/lib/pages/pageActions";
import { executePageAction } from "@/lib/pages/executePageAction";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import * as Icons from "lucide-react";

interface PageActionsBarProps {
  actions: PageAction[];
  context?: ActionContext;
  onActionComplete?: (result: { success: boolean; error?: string }) => void;
}

// Icon mapping
const getIcon = (iconName?: string) => {
  if (!iconName) return Icons.Zap;
  const Icon = (Icons as any)[iconName];
  return Icon || Icons.Zap;
};

export default function PageActionsBar({ actions, context, onActionComplete }: PageActionsBarProps) {
  const router = useRouter();
  const [executing, setExecuting] = useState<Set<string>>(new Set());

  // Filter to page-level actions only
  const pageActions = actions.filter(a => (a.scope || "page") === "page");

  if (pageActions.length === 0) return null;

  const handleAction = async (action: PageAction) => {
    // Check confirmation
    if (action.requiresConfirmation) {
      const message = action.confirmationMessage || `Are you sure you want to ${action.label}?`;
      if (!confirm(message)) return;
    }

    setExecuting(prev => new Set(prev).add(action.id));

    try {
      const actionContext: ActionContext = {
        ...context,
        router,
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
    <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {pageActions.map((action) => {
        const Icon = getIcon(action.icon);
        const isExecuting = executing.has(action.id);
        
        // Check visibility condition
        if (context?.record && !shouldShowAction(action, context.record)) {
          return null;
        }

        return (
          <Button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={isExecuting}
            variant="outline"
            size="sm"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Icon className="w-4 h-4 mr-1" />
                {action.label}
              </>
            )}
          </Button>
        );
      })}
    </div>
  );
}
