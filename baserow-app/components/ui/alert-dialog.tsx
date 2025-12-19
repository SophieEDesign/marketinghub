// Temporary compatibility shim - re-export Dialog components as AlertDialog
// This file exists to satisfy build cache that may reference alert-dialog
// All actual usage has been migrated to Dialog component

export {
  Dialog as AlertDialog,
  DialogContent as AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
} from "./dialog"

// Re-export Button as AlertDialogAction and AlertDialogCancel for compatibility
import { Button } from "./button"

export const AlertDialogAction = Button
export const AlertDialogCancel = Button
