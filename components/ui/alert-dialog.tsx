// Temporary compatibility shim - re-export Dialog components as AlertDialog
// This file exists to satisfy build cache that may reference alert-dialog
// All actual usage has been migrated to Dialog component

"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Button } from "./button"

// Re-export Dialog components as AlertDialog for compatibility
export const AlertDialog = Dialog
export const AlertDialogContent = DialogContent
export const AlertDialogDescription = DialogDescription
export const AlertDialogFooter = DialogFooter
export const AlertDialogHeader = DialogHeader
export const AlertDialogTitle = DialogTitle

// Re-export Button as AlertDialogAction and AlertDialogCancel for compatibility
export const AlertDialogAction = Button
export const AlertDialogCancel = Button
