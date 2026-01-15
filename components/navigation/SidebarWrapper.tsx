'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useIsMobileOrTablet } from '../../baserow-app/hooks/useResponsive'
import Sidebar from './Sidebar'
import { cn } from '@/lib/utils'

export default function SidebarWrapper() {
  const [isOpen, setIsOpen] = useState(false)
  const isMobileOrTablet = useIsMobileOrTablet()
  const pathname = usePathname()

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobileOrTablet && isOpen) {
      setIsOpen(false)
    }
  }, [pathname, isMobileOrTablet, isOpen])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOrTablet && isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOrTablet, isOpen])

  return (
    <>
      {/* Hamburger menu button - only visible on mobile/tablet */}
      {isMobileOrTablet && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 left-4 z-50 p-2 rounded-md bg-white border border-gray-200 shadow-lg hover:bg-gray-50 transition-colors md:hidden"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="h-5 w-5 text-gray-700" />
          ) : (
            <Menu className="h-5 w-5 text-gray-700" />
          )}
        </button>
      )}

      {/* Overlay for mobile/tablet */}
      {isMobileOrTablet && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'transition-transform duration-300 ease-in-out',
          isMobileOrTablet
            ? 'fixed left-0 top-0 h-screen z-50'
            : 'relative',
          isMobileOrTablet && !isOpen && '-translate-x-full'
        )}
      >
        <Sidebar />
      </div>
    </>
  )
}
