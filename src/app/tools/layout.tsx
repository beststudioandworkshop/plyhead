import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <nav className="flex items-baseline gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Plyhead
          </Link>
          <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground">
            Tools
          </Link>
        </nav>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 sm:px-8">{children}</main>
    </div>
  )
}
