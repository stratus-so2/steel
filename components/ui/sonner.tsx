'use client'

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, InformationCircleIcon, Alert02Icon, MultiplicationSignCircleIcon, Loading03Icon } from "@hugeicons-pro/core-solid-rounded"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      expand
      offset={20}
      icons={{
        success: (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
        ),
        info: (
          <HugeiconsIcon icon={InformationCircleIcon} className="size-5" />
        ),
        warning: (
          <HugeiconsIcon icon={Alert02Icon} className="size-5" />
        ),
        error: (
          <HugeiconsIcon icon={MultiplicationSignCircleIcon} className="size-5" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
