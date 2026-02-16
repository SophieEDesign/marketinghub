'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FilePlus, LayoutGrid, Users, X } from 'lucide-react'

const WELCOME_SEEN_KEY = 'marketing_hub_welcome_seen'

export default function WelcomeScreen() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    const seen = localStorage.getItem(WELCOME_SEEN_KEY)
    if (!seen) {
      setOpen(true)
    }
  }, [mounted])

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WELCOME_SEEN_KEY, 'true')
    }
    setOpen(false)
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={handleDismiss}>
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Marketing Hub</DialogTitle>
          <DialogDescription>
            Get started with a few quick actions to make the most of your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Link href="/settings?tab=pages" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
              <FilePlus className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <span className="font-medium block">Create your first page</span>
                <span className="text-sm text-muted-foreground">Add a new interface page from Settings</span>
              </div>
            </Button>
          </Link>
          <Link href="/interface/new" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
              <LayoutGrid className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <span className="font-medium block">Add a block</span>
                <span className="text-sm text-muted-foreground">Build dashboards with grids, charts, and KPIs</span>
              </div>
            </Button>
          </Link>
          <Link href="/settings?tab=users" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
              <Users className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <span className="font-medium block">Invite your team</span>
                <span className="text-sm text-muted-foreground">Add users and manage access</span>
              </div>
            </Button>
          </Link>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="gap-2">
            <X className="h-4 w-4" />
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
