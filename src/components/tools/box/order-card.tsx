"use client"

import * as React from "react"
import { CheckIcon, LinkIcon, MailIcon } from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { SHOP } from "@/config/shop"
import {
  requestBody,
  requestMailto,
  requestSubject,
  shareUrl,
  type Dims,
  type Estimate,
  type RequestContact,
  type ShareState,
  type Unit,
} from "@/lib/box"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: SHOP.currency })

function Breakdown({ estimate }: { estimate: Estimate }) {
  return (
    <Accordion>
      <AccordionItem value="lines">
        <AccordionTrigger>See the breakdown</AccordionTrigger>
        <AccordionContent>
          <Table>
            <TableBody>
              {estimate.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="whitespace-normal">
                    {line.label}
                    {line.qty !== 1 ? <span className="text-muted-foreground"> × {line.qty}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money.format(line.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function OrderCard({
  diy,
  kit,
  state,
  exterior,
  interior,
  unit,
}: {
  diy: Estimate
  kit: Estimate
  state: ShareState
  exterior: Dims
  interior: Dims
  unit: Unit
}) {
  const [contact, setContact] = React.useState<RequestContact>({ name: "", email: "", zip: "", notes: "" })
  const [open, setOpen] = React.useState(false)

  const link = () => shareUrl(window.location.origin, state)
  const args = () => ({
    kind: "kit" as const,
    contact,
    inputs: state.inputs,
    exterior,
    interior,
    unit,
    link: link(),
    estimate: { total: money.format(kit.total), example: SHOP.placeholderPrices },
  })

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(done)
    } catch {
      toast.error("Couldn't copy. Select the text instead.")
    }
  }

  const send = () => {
    const url = requestMailto(SHOP.email, args())
    if (url) window.location.href = url
  }

  const set = (key: keyof RequestContact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setContact((c) => ({ ...c, [key]: e.target.value }))

  return (
    <Card className="card-tone">
      <CardHeader>
        <CardTitle>Build it</CardTitle>
        <CardDescription>
          Two ways to get this box. {SHOP.placeholderPrices ? "Prices shown are examples for now." : "Estimates only."}{" "}
          The final price is confirmed by email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="font-medium">Build it yourself</h3>
            <p className="text-2xl font-semibold tabular-nums">{money.format(diy.total)}</p>
            <p className="text-sm text-muted-foreground">
              Plywood, hardware, screws and glue, plus an allowance for finish. You do the cutting.
            </p>
            <Breakdown estimate={diy} />
          </section>

          <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="font-medium">Cut kit from {SHOP.name}</h3>
            <p className="text-2xl font-semibold tabular-nums">{money.format(kit.total)}</p>
            <p className="text-sm text-muted-foreground">
              {SHOP.owner} cuts every part, adds Domino joints and pilot holes, packs it and ships it. You glue and
              screw it together.
            </p>
            <Breakdown estimate={kit} />
          </section>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>Request this kit</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request this kit</DialogTitle>
                <DialogDescription>
                  This opens an email to {SHOP.owner} with your design attached as a link. Nothing is sent until you
                  hit send in your email.
                </DialogDescription>
              </DialogHeader>
              <div className="entry-fields flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-name">Your name</Label>
                  <Input id="req-name" autoComplete="name" value={contact.name} onChange={set("name")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-email">Your email</Label>
                  <Input id="req-email" type="email" autoComplete="email" value={contact.email} onChange={set("email")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-zip">Ship to ZIP or postcode</Label>
                  <Input id="req-zip" autoComplete="postal-code" value={contact.zip} onChange={set("zip")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-notes">Anything else?</Label>
                  <Textarea id="req-notes" rows={3} value={contact.notes} onChange={set("notes")} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    copy(`Subject: ${requestSubject(args())}\n\n${requestBody(args())}`, "Request copied")
                  }
                >
                  Copy request
                </Button>
                <Button onClick={send} disabled={!SHOP.email}>
                  <MailIcon data-icon="inline-start" />
                  Email my request
                </Button>
              </DialogFooter>
              {!SHOP.email ? (
                <p className="text-sm text-muted-foreground">
                  The shop&apos;s email address isn&apos;t set up yet. Copy the request and email it to {SHOP.owner}.
                </p>
              ) : null}
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => copy(link(), "Link copied")}>
            <LinkIcon data-icon="inline-start" />
            Copy link to this design
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckIcon className="size-4" aria-hidden />
          The link reopens this exact box, so you can send it to a friend or to {SHOP.owner}.
        </p>
      </CardContent>
    </Card>
  )
}
