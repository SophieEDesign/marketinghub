"use client";

import { useState, useRef, useEffect } from "react";
import { X, ArrowLeft, ArrowRight, EyeOff, RotateCcw, Lock } from "lucide-react";

interface ColumnMenuProps {
  fieldId: string;
  fieldLabel: string;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  onHide?: () => void;
  onRename?: (newName: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onResetWidth?: () => void;
  onFreeze?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  isFrozen?: boolean;
}

export default function ColumnMenu({
  fieldId,
  fieldLabel,
  isOpen,
  onClose,
  position,
  onHide,
  onRename,
  onMoveLeft,
  onMoveRight,
  onResetWidth,
  onFreeze,
  canMoveLeft = true,
  canMoveRight = true,
  isFrozen = false,
}: ColumnMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(fieldLabel);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (isOpen) {
      setNewName(fieldLabel);
      setRenaming(false);
    }
  }, [isOpen, fieldLabel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRename = () => {
    if (newName.trim() && newName !== fieldLabel && onRename) {
      onRename(newName.trim());
    }
    setRenaming(false);
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {renaming ? (
        <div className="px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRename();
              } else if (e.key === "Escape") {
                setRenaming(false);
                setNewName(fieldLabel);
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => setRenaming(true)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <span>Rename column</span>
          </button>
          {onHide && (
            <button
              onClick={() => {
                onHide();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <EyeOff className="w-4 h-4" />
              <span>Hide column</span>
            </button>
          )}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          {onMoveLeft && (
            <button
              onClick={() => {
                onMoveLeft();
                onClose();
              }}
              disabled={!canMoveLeft}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Move left</span>
            </button>
          )}
          {onMoveRight && (
            <button
              onClick={() => {
                onMoveRight();
                onClose();
              }}
              disabled={!canMoveRight}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Move right</span>
            </button>
          )}
          {onResetWidth && (
            <button
              onClick={() => {
                onResetWidth();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset width</span>
            </button>
          )}
          {onFreeze && (
            <button
              onClick={() => {
                onFreeze();
                onClose();
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                isFrozen ? "bg-blue-50 dark:bg-blue-900/20" : ""
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>{isFrozen ? "Unfreeze column" : "Freeze column"}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
