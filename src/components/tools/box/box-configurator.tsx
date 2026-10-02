"use client"

import * as React from "react"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DEFAULT_CLEARANCE_MM,
  DEFAULT_EXTERIOR,
  DEFAULT_JOINERY,
  DEFAULT_LEGS,
  THICKNESS_PRESETS,
  buildBox,
  formatLength,
  groupParts,
  resolveDimensions,
  type BoxInputs,
  type DimensionMode,
  type Dims,
  type LidPosition,
  type Unit,
} from "@/lib/box"

import { Controls } from "./controls"
import { CutList } from "./cut-list"

const INITIAL: BoxInputs = {
  dimensionMode: "exterior",
  dims: DEFAULT_EXTERIOR,
  clearance: DEFAULT_CLEARANCE_MM,
  thickness: THICKNESS_PRESETS[1].mm,
  lidPosition: "top",
  lidType: "full",
  openLeaf: "right",
  legs: { face: null, ...DEFAULT_LEGS },
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

  // The legs can't sit on the lid face, so moving the lid onto them removes them.
  const changeLidPosition = (position: LidPosition) =>
    setInputs((prev) => ({
      ...prev,
      lidPosition: position,
      legs: prev.legs.face === position ? { ...prev.legs, face: null } : prev.legs,
    }))

  const result = React.useMemo(() => buildBox(inputs), [inputs])
  const rows = React.useMemo(() => groupParts(result.parts), [result.parts])

  const overall: Dims = {
    w: result.bounds.max[0] - result.bounds.min[0],
    h: result.bounds.max[1] - result.bounds.min[1],
    d: result.bounds.max[2] - result.bounds.min[2],
  }
  const hasLegs = inputs.legs.face !== null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr] lg:items-start">
      <Card className="lg:col-start-1">
        <CardHeader>
          <CardTitle>Your box</CardTitle>
          <CardDescription>The 3D preview comes next. For now, these are the sizes.</CardDescription>
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
              <AlertTitle>That box can't be built yet</AlertTitle>
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

      <Card className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
            onLidPosition={changeLidPosition}
            onLegs={(p) => setInputs((prev) => ({ ...prev, legs: { ...prev.legs, ...p } }))}
          />
        </CardContent>
      </Card>

      {result.ok ? (
        <div className="lg:col-start-1">
          <CutList rows={rows} unit={unit} />
        </div>
      ) : null}
    </div>
  )
}

