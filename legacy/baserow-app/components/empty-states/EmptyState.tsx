"use client"

import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TEXT_EMPTY } from "@/lib/interface/typography-tokens"

export type EmptyStateVariant = "default" | "compact" | "inline"

interface EmptyStateProps {
  icon?: ReactNode
  illustration?: ReactNode
  title: string
  description?: string
  variant?: EmptyStateVariant
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  children?: ReactNode
}

export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  variant = "default",
  action,
  secondaryAction,
  children,
}: EmptyStateProps) {
  if (variant === "inline") {
    return <p className={TEXT_EMPTY}>{title}</p>
  }

  if (variant === "compact") {
    return (
      <Wrapper className="flex flex-col items-center justify-center py-6 px-3 text-center">
        {(illustration || icon) && (
          <IconWrap className="mb-2 flex items-center justify-center text-muted-foreground/60">
            {illustration ?? icon}
          </IconWrap>
        )}
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground/75 max-w-sm mt-1 mb-3">{description}</p>
        )}
        {(action || secondaryAction) && (
          <Actions className="flex items-center gap-2">
            {action && (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </Actions>
        )}
        {children}
      </Wrapper>
    )
  }

  return (
    <Wrapper className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {(illustration || icon) && (
        <IconWrap
          className={cn(
            "mb-3 flex items-center justify-center",
            illustration && "rounded-inner bg-muted/25 p-4"
          )}
        >
          {illustration ?? icon}
        </IconWrap>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      )}
      {children && <ChildWrap className="mb-4">{children}</ChildWrap>}
      {(action || secondaryAction) && (
        <Actions className="flex items-center gap-3">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </Actions>
      )}
    </Wrapper>
  )
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={className}>{children}</section>
}
function IconWrap({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={className}>{children}</span>
}
function Actions({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex", className)}>{children}</span>
}
function ChildWrap({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={className}>{children}</span>
}
