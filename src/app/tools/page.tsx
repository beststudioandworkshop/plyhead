import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Tools" }

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-2 text-muted-foreground">Free tools for planning what you want built.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/tools/box" className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Plywood box</CardTitle>
              <CardDescription>
                Set the size, lid and legs, and get the sizes of every piece to cut.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
