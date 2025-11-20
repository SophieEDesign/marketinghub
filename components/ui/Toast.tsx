"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, Info, AlertCircle } from "lucide-react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "info" | "warning" | "error";
  duration?: number;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

export function toast(options: Omit<Toast, "id">) {
  const id = Math.random().toString(36).substring(7);
  const newToast: Toast = {
    id,
    duration: 3000,
    ...options,
  };

  toasts = [...toasts, newToast];
  notify();

  if (newToast.duration && newToast.duration > 0) {
    setTimeout(() => {
      dismiss(id);
    }, newToast.duration);
  }

  return id;
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>(toasts);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToastList(newToasts);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return { toasts: toastList, toast, dismiss };
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${
            toast.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
              : toast.type === "error"
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
              : toast.type === "warning"
              ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
          }`}
        >
          {toast.type === "success" && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {toast.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {toast.type === "warning" && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {(!toast.type || toast.type === "info") && <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{toast.title}</div>
            {toast.description && (
              <div className="text-xs mt-1 opacity-90">{toast.description}</div>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-current opacity-70 hover:opacity-100 transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

