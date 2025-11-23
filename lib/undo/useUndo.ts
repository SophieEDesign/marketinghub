"use client";

import { useState, useCallback, useRef } from "react";

export interface UndoAction {
  id: string;
  type: string;
  description: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
  timestamp: number;
}

const MAX_HISTORY = 20;

export function useUndo() {
  const [history, setHistory] = useState<UndoAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const actionIdCounter = useRef(0);

  const addAction = useCallback(
    (action: Omit<UndoAction, "id" | "timestamp">) => {
      const newAction: UndoAction = {
        ...action,
        id: `action_${actionIdCounter.current++}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Remove any actions after current index (when undoing and then doing a new action)
        const newHistory = prev.slice(0, currentIndex + 1);
        // Add new action
        const updated = [...newHistory, newAction];
        // Limit to MAX_HISTORY
        return updated.slice(-MAX_HISTORY);
      });

      setCurrentIndex((prev) => {
        const newIndex = Math.min(prev + 1, MAX_HISTORY - 1);
        return newIndex;
      });

      return newAction.id;
    },
    [currentIndex]
  );

  const undo = useCallback(async () => {
    if (currentIndex < 0) return false;

    const action = history[currentIndex];
    if (action) {
      await action.undo();
      setCurrentIndex((prev) => prev - 1);
      return true;
    }
    return false;
  }, [currentIndex, history]);

  const redo = useCallback(async () => {
    if (currentIndex >= history.length - 1) return false;

    const nextIndex = currentIndex + 1;
    const action = history[nextIndex];
    if (action) {
      await action.redo();
      setCurrentIndex(nextIndex);
      return true;
    }
    return false;
  }, [currentIndex, history]);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;
  const lastAction = history[currentIndex] || null;

  return {
    addAction,
    undo,
    redo,
    canUndo,
    canRedo,
    lastAction,
    history,
  };
}

