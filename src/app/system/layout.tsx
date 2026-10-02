import type { Metadata } from "next"
import { SystemShell } from "@/components/system-shell"

export const metadata: Metadata = {
  title: "Design system",
}

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SystemShell>{children}</SystemShell>
}
