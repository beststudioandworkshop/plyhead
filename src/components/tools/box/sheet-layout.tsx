"use client"

import * as React from "react"
import { AlertCircleIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PART_COLORS,
  buildDxf,
  formatLength,
  type NestResult,
  type NestedSheet,
  type Part,
  type Unit,
} from "@/lib/box"

function SheetDrawing({ nest, sheet, unit }: { nest: NestResult; sheet: NestedSheet; unit: Unit }) {
  // Tall sheets (4×8) are drawn turned on their side so the parts are readable.
  // It's a pure 90° rotation, so left/right and up/down keep their meaning.
  const turned = nest.sheet.h > nest.sheet.w
  const w = turned ? nest.sheet.h : nest.sheet.w
  const h = turned ? nest.sheet.w : nest.sheet.h
  const stroke = w / 500
  const font = w / 48
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
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
      </svg>
      <figcaption className="text-sm text-muted-foreground">
        Sheet {sheet.index + 1}: {Math.round((sheet.usedArea / (nest.sheet.w * nest.sheet.h)) * 100)}% used
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
            : `${nest.sheets.length} ${nest.sheets.length === 1 ? "sheet" : "sheets"} of ${nest.sheet.label.toLowerCase()}, ${Math.round(nest.yield * 100)}% of the material used. Straight cuts only, with the saw kerf allowed for.`}
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
