"use client"

import * as React from "react"
import { AlertCircleIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PART_COLORS,
  buildDxf,
  formatLength,
  type Cut,
  type NestResult,
  type NestedSheet,
  type Part,
  type Unit,
} from "@/lib/box"

/** Where a cut's edge is measured from, in the sheet as it is drawn (4×8 sheets are drawn turned on their side). */
const turned = (nest: NestResult) => nest.sheet.h > nest.sheet.w

function nearEdge(cut: Cut, turned: boolean) {
  if (cut.orientation === "vertical") return turned ? "bottom" : "left"
  return turned ? "left" : "top"
}

function cutText(cut: Cut, unit: Unit, turned: boolean) {
  const a = Math.max(cut.panel.w, cut.panel.h)
  const b = Math.min(cut.panel.w, cut.panel.h)
  return `${cut.axis === "rip" ? "Rip" : "Cross-cut"} the ${formatLength(a, unit)} × ${formatLength(b, unit)} panel: measure ${formatLength(cut.offset, unit)} from its ${nearEdge(cut, turned)} edge, then cut (${formatLength(cut.length, unit)} long).`
}

function SheetDrawing({ nest, sheet, unit }: { nest: NestResult; sheet: NestedSheet; unit: Unit }) {
  // Tall sheets (4×8) are drawn turned on their side so the parts are readable.
  // It's a pure 90° rotation, so left/right and up/down keep their meaning.
  const turned = nest.sheet.h > nest.sheet.w
  const w = turned ? nest.sheet.h : nest.sheet.w
  const h = turned ? nest.sheet.w : nest.sheet.h
  const stroke = w / 500
  const font = w / 48
  // Room around the sheet so the cut-number circles on its edges aren't clipped.
  const pad = font * 1.2
  // Sheet coordinates → what's drawn: a quarter turn when the sheet is drawn on its side.
  const view = (x: number, y: number): [number, number] => (turned ? [y, nest.sheet.w - x] : [x, y])
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
        role="img"
        aria-label={`Sheet ${sheet.index + 1} with ${sheet.placements.length} parts`}
        className="h-auto max-h-[28rem] w-full rounded-md border border-border bg-muted/40"
      >
        {sheet.placements.map((placed) => {
          const p = turned
            ? { ...placed, x: placed.y, y: nest.sheet.w - (placed.x + placed.w), w: placed.h, h: placed.w }
            : placed
          // Label only when the text will actually fit.
          const label = p.name
          const fits = p.w > font * label.length * 0.62 && p.h > font * 2.4
          return (
            <g key={p.partId}>
              <title>{`${p.name}: ${formatLength(p.w, unit)} × ${formatLength(p.h, unit)}`}</title>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={PART_COLORS[p.type]}
                stroke="var(--foreground)"
                strokeOpacity={0.55}
                strokeWidth={stroke}
              />
              {fits ? (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={font}
                  fill="var(--foreground)"
                  stroke="var(--background)"
                  strokeWidth={font / 6}
                  style={{ paintOrder: "stroke" }}
                >
                  {label}
                </text>
              ) : null}
            </g>
          )
        })}
        {sheet.cuts.length <= 30
          ? sheet.cuts.map((cut) => {
              // The cut line sits in the kerf, just past the finished edge of the piece.
              const at = cut.position + nest.kerf / 2
              const [x1, y1, x2, y2] =
                cut.orientation === "vertical"
                  ? [at, cut.panel.y, at, cut.panel.y + cut.panel.h]
                  : [cut.panel.x, at, cut.panel.x + cut.panel.w, at]
              const [ax, ay] = view(x1, y1)
              const [bx, by] = view(x2, y2)
              return (
                <g key={cut.index}>
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="var(--foreground)"
                    strokeWidth={stroke * 1.4}
                    strokeDasharray={`${font * 0.9} ${font * 0.6}`}
                  />
                  <circle cx={ax} cy={ay} r={font * 0.7} fill="var(--background)" stroke="var(--foreground)" strokeWidth={stroke} />
                  <text
                    x={ax}
                    y={ay}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={font * 0.85}
                    fill="var(--foreground)"
                  >
                    {cut.index}
                  </text>
                </g>
              )
            })
          : null}
      </svg>
      <figcaption className="text-sm text-muted-foreground">
        Sheet {sheet.index + 1}: {Math.round((sheet.usedArea / (nest.sheet.w * nest.sheet.h)) * 100)}% used, {sheet.cuts.length}{" "}
        {sheet.cuts.length === 1 ? "cut" : "cuts"}
      </figcaption>
    </figure>
  )
}

export function SheetLayout({ nest, parts, unit }: { nest: NestResult; parts: Part[]; unit: Unit }) {
  const [busy, setBusy] = React.useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const dxf = await buildDxf(nest, parts, { unit })
      const blob = new Blob([dxf], { type: "application/dxf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "plywood-box.dxf"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Couldn't create the DXF file.")
    } finally {
      setBusy(false)
    }
  }

  const hasPolygons = parts.some((p) => p.shape === "polygon")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sheet layout</CardTitle>
        <CardDescription>
          {nest.sheets.length === 0
            ? "Nothing to lay out."
            : `${nest.sheets.length} ${nest.sheets.length === 1 ? "sheet" : "sheets"} of ${nest.sheet.label.toLowerCase()}, ${Math.round(nest.yield * 100)}% of the material used. Every cut runs edge to edge, with the saw kerf allowed for. ${nest.cutCount} ${nest.cutCount === 1 ? "cut" : "cuts"}, ${formatLength(nest.cutLength, unit)} of cutting in all.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {nest.unplaced.length > 0 ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Too big for this sheet</AlertTitle>
            <AlertDescription>
              {Array.from(new Set(nest.unplaced.map((p) => p.name))).join(", ")} won&apos;t fit on a{" "}
              {nest.sheet.label.toLowerCase()}. Make the box smaller or pick a bigger sheet.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={download} disabled={busy || nest.sheets.length === 0}>
            <DownloadIcon data-icon="inline-start" />
            Download DXF
          </Button>
          <span className="text-sm text-muted-foreground">One layer per part type, for CNC.</span>
        </div>

        <div className="grid gap-4">
          {nest.sheets.map((sheet) => (
            <SheetDrawing key={sheet.index} nest={nest} sheet={sheet} unit={unit} />
          ))}
        </div>

        {nest.sheets.some((sh) => sh.cuts.length > 0) ? (
          <Accordion>
            <AccordionItem value="plan">
              <AccordionTrigger>Cutting plan</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4">
                <p>
                  Do the cuts in this order. Each one goes all the way across the panel you are cutting, so it works
                  with a table saw, circular saw or track saw. The numbers match the circles on the drawing.
                </p>
                {nest.sheets.map((sheet) => (
                  <div key={sheet.index}>
                    <h4 className="mb-1 font-medium">Sheet {sheet.index + 1}</h4>
                    <ol className="list-decimal pl-5">
                      {sheet.cuts.map((cut) => (
                        <li key={cut.index}>{cutText(cut, unit, turned(nest))}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}

        {nest.excluded.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            The {nest.excluded.length} dowel legs aren&apos;t on the sheet: cut them from dowel stock.
          </p>
        ) : null}
        {hasPolygons ? (
          <p className="text-sm text-muted-foreground">
            Tapered leg plates are laid out as their bounding rectangles in this preview. The DXF has their true
            shape.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
