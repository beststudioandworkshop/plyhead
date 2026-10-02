"use client"

import * as React from "react"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DEFAULT_CLEARANCE_MM,
  DEFAULT_EXTERIOR,
  DEFAULT_JOINERY,
  DEFAULT_KERF_MM,
  DEFAULT_LEGS,
  JOINERY,
  SHEET_PRESETS,
  SPAN_SUGGEST_RATIO,
  THICKNESS_PRESETS,
  buildBox,
  formatLength,
  groupParts,
  nestParts,
  resolveDimensions,
  suggestDivider,
  type BoxInputs,
  type DimensionMode,
  type Dims,
  type SheetPreset,
  type Unit,
} from "@/lib/box"

import { Controls } from "./controls"
import { CutList } from "./cut-list"
import { HowTo } from "./how-to"
import { PreviewCard } from "./preview-card"
import { SheetLayout } from "./sheet-layout"

const INITIAL: BoxInputs = {
  dimensionMode: "exterior",
  dims: DEFAULT_EXTERIOR,
  clearance: DEFAULT_CLEARANCE_MM,
  thickness: THICKNESS_PRESETS[1].mm,
  lidPosition: "top",
  lidType: "full",
  openLeaf: "second",
  hingeSide: "long",
  bottomStyle: "inset",
  dividers: 0,
  legs: { style: "none", ...DEFAULT_LEGS },
  joinery: DEFAULT_JOINERY,
}

function DimsLine({ label, dims, unit }: { label: string; dims: Dims; unit: Unit }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">
        {formatLength(dims.w, unit)} × {formatLength(dims.d, unit)} × {formatLength(dims.h, unit)}
      </dd>
    </div>
  )
}

export function BoxConfigurator() {
  const [inputs, setInputs] = React.useState<BoxInputs>(INITIAL)
  const [unit, setUnit] = React.useState<Unit>("in")
  const [thicknessPreset, setThicknessPreset] = React.useState(THICKNESS_PRESETS[1].id)
  const [sheetId, setSheetId] = React.useState<SheetPreset["id"]>("4x8")
  const [kerfMm, setKerfMm] = React.useState(DEFAULT_KERF_MM)

  const patch = (p: Partial<BoxInputs>) => setInputs((prev) => ({ ...prev, ...p }))

  // Switching mode keeps the same physical box: carry over the other measurement.
  const changeMode = (mode: DimensionMode) => {
    setInputs((prev) => {
      if (prev.dimensionMode === mode) return prev
      const { exterior, interior } = resolveDimensions(prev)
      const dims =
        mode === "interior"
          ? {
              w: Math.max(interior.w - prev.clearance, 0),
              d: Math.max(interior.d - prev.clearance, 0),
              h: Math.max(interior.h - prev.clearance, 0),
            }
          : exterior
      return { ...prev, dimensionMode: mode, dims }
    })
  }

  const changePreset = (id: string) => {
    setThicknessPreset(id)
    const preset = THICKNESS_PRESETS.find((p) => p.id === id)
    if (preset) patch({ thickness: preset.mm })
  }

  const result = React.useMemo(() => buildBox(inputs), [inputs])
  const rows = React.useMemo(() => groupParts(result.parts), [result.parts])
  const sheet = SHEET_PRESETS.find((p) => p.id === sheetId) ?? SHEET_PRESETS[0]
  const nest = React.useMemo(() => nestParts(result.parts, sheet, kerfMm), [result.parts, sheet, kerfMm])
  const dividerTip = React.useMemo(
    () =>
      suggestDivider(
        inputs.dividers,
        JOINERY[inputs.joinery].interiorBox(result.exterior, inputs.thickness),
        inputs.lidPosition,
        inputs.lidType,
        inputs.hingeSide,
        inputs.thickness,
        SPAN_SUGGEST_RATIO,
      ),
    [inputs, result.exterior],
  )

  const overall: Dims = {
    w: result.bounds.max[0] - result.bounds.min[0],
    h: result.bounds.max[1] - result.bounds.min[1],
    d: result.bounds.max[2] - result.bounds.min[2],
  }
  const hasLegs = inputs.legs.style !== "none"

  return (
    <div className="grid gap-6 lg:grid-cols-[26rem_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
      <PreviewCard result={result} lidPosition={inputs.lidPosition} />

      <Card className="lg:col-start-2">
        <CardHeader>
          <CardTitle>Your box</CardTitle>
          <CardDescription>The finished sizes, from your settings.</CardDescription>
        </CardHeader>
        <CardContent>
          {result.ok ? (
            <dl className="flex flex-col gap-2">
              <DimsLine label="Outside (W × D × H)" dims={result.exterior} unit={unit} />
              <DimsLine label="Inside (W × D × H)" dims={result.interior} unit={unit} />
              {hasLegs ? <DimsLine label="Overall with legs" dims={overall} unit={unit} /> : null}
            </dl>
          ) : (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>That box can&apos;t be built yet</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {result.issues.map((i) => (
                    <li key={i.code}>{i.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="entry-zone lg:col-start-1 lg:row-span-3 lg:row-start-1">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Controls
            state={{ inputs, unit, thicknessPreset }}
            onUnit={setUnit}
            onMode={changeMode}
            onInputs={patch}
            onThicknessPreset={changePreset}
            exterior={result.exterior}
            dividerTip={result.ok ? dividerTip : null}
            sheetId={sheetId}
            kerfMm={kerfMm}
            onSheet={setSheetId}
            onKerf={setKerfMm}
            onLegs={(p) => setInputs((prev) => ({ ...prev, legs: { ...prev.legs, ...p } }))}
          />
        </CardContent>
      </Card>

      {result.ok ? (
        <div className="flex flex-col gap-6 lg:col-start-2">
          <CutList rows={rows} unit={unit} />
          <SheetLayout nest={nest} parts={result.parts} unit={unit} />
          <HowTo inputs={inputs} unit={unit} />
        </div>
      ) : null}
    </div>
  )
}

