"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfaceCreationModal from "@/components/interface/InterfaceCreationModal"

export default function NewInterfacePage() {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(true)

  return (
    <WorkspaceShellWrapper title="New Interface">
      <div className="max-w-2xl mx-auto mt-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Create New Interface</h2>
          <p className="text-gray-600 mb-6">
            Interfaces are containers that group related pages together.
          </p>
        </div>
      </div>
      <InterfaceCreationModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) {
            // Navigate back if modal is closed
            router.push("/settings?tab=interfaces")
          }
        }}
        onCreated={(interfaceId) => {
          // Navigate to settings interfaces tab after creation
          router.push("/settings?tab=interfaces")
        }}
      />
    </WorkspaceShellWrapper>
  )
}
