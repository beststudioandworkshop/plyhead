import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <span className="text-lg font-semibold tracking-tight">Plyhead</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Plyhead
        </h1>
        <p className="text-muted-foreground">Site coming soon.</p>
        <Button render={<Link href="/tools" />}>Tools</Button>
      </main>
      <Separator />
      <footer className="flex items-center justify-between px-4 py-4 text-sm text-muted-foreground sm:px-8">
        <span>© Plyhead</span>
        <Button variant="link" render={<Link href="/system" />}>
          Design system
        </Button>
      </footer>
    </div>
  )
}
