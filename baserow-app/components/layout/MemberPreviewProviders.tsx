"use client"

import type { ReactNode } from "react"
import {
  MemberPreviewProvider,
  useMemberPreview,
  type ShellUserRole,
} from "@/contexts/MemberPreviewContext"
import { EditModeProvider } from "@/contexts/EditModeContext"
import { UIModeProvider } from "@/contexts/UIModeContext"
import { SidebarModeProvider } from "@/contexts/SidebarModeContext"
import MemberPreviewEffects from "./MemberPreviewEffects"

interface MemberPreviewProvidersProps {
  children: ReactNode
  userRole: ShellUserRole
}

function EditModeWithPreview({ children }: { children: ReactNode }) {
  const { isMemberPreview } = useMemberPreview()
  return (
    <EditModeProvider isViewer={isMemberPreview}>
      <MemberPreviewEffects />
      <UIModeProvider>
        <SidebarModeProvider>{children}</SidebarModeProvider>
      </UIModeProvider>
    </EditModeProvider>
  )
}

/** Client shell providers: member preview + edit mode + UI mode */
export default function MemberPreviewProviders({
  children,
  userRole,
}: MemberPreviewProvidersProps) {
  return (
    <MemberPreviewProvider userRole={userRole}>
      <EditModeWithPreview>{children}</EditModeWithPreview>
    </MemberPreviewProvider>
  )
}
