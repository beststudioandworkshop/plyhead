"use client"

import { LinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { shareUrl, type ShareState } from "@/lib/box"

export function ShareCard({ state }: { state: ShareState }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(window.location.origin, state))
      toast.success("Link copied")
    } catch {
      toast.error("Couldn't copy the link.")
    }
  }
  return (
    <Card className="card-tone">
      <CardHeader>
        <CardTitle>Share this design</CardTitle>
        <CardDescription>
          A link that reopens this exact box, with every setting as you have it. Send it to a friend or save it for
          later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={copy}>
          <LinkIcon data-icon="inline-start" />
          Copy link to this design
        </Button>
      </CardContent>
    </Card>
  )
}
