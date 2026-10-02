"use client"

import { Choice } from "./choice"
import { DimensionInput } from "./dimension-input"
import { SIZE_HINTS } from "./hints"
import { FieldGroup, Field, FieldLabel, FieldTitle, FieldDescription } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  LEG_FACES,
  THICKNESS_PRESETS,
  formatThickness,
  legFaceOptions,
  type BoxInputs,
  type DimensionMode,
  type Face,
  type LeafSide,
  type LidPosition,
  type LidType,
  type Unit,
} from "@/lib/box"

export const CUSTOM_THICKNESS = "custom"

export interface ControlsState {
  inputs: BoxInputs
  unit: Unit
  /** Preset id, or CUSTOM_THICKNESS. */
  thicknessPreset: string
}

interface ControlsProps {
  state: ControlsState
  onUnit: (unit: Unit) => void
  onMode: (mode: DimensionMode) => void
  onInputs: (patch: Partial<BoxInputs>) => void
  onThicknessPreset: (id: string) => void
  onLidPosition: (position: LidPosition) => void
  onLegs: (patch: Partial<BoxInputs["legs"]>) => void
}

const FACE_LABEL: Record<Face, string> = {
  bottom: "Bottom",
  back: "Back",
  left: "Left",
  right: "Right",
  front: "Front",
  top: "Top",
}

export function Controls({ state, onUnit, onMode, onInputs, onThicknessPreset, onLidPosition, onLegs }: ControlsProps) {
  const { inputs, unit, thicknessPreset } = state
  const interior = inputs.dimensionMode === "interior"
  const faceOptions = legFaceOptions(inputs.lidPosition)
  const hasLegs = inputs.legs.face !== null

  const setDim = (key: "w" | "d" | "h") => (mm: number) => onInputs({ dims: { ...inputs.dims, [key]: mm } })

  return (
    <FieldGroup>
      <Field>
        <FieldTitle>Units</FieldTitle>
        <Choice<Unit>
          label="Units"
          value={unit}
          onChange={onUnit}
          options={[
            { value: "in", label: "Inches" },
            { value: "mm", label: "Millimetres" },
          ]}
        />
      </Field>

      <Separator />

      <Field>
        <FieldTitle>Size</FieldTitle>
        <Choice<DimensionMode>
          label="Dimension mode"
          value={inputs.dimensionMode}
          onChange={onMode}
          options={[
            { value: "exterior", label: "Outside size" },
            { value: "interior", label: "Fit inside" },
          ]}
        />
        <FieldDescription>
          {interior
            ? "Enter the size of what needs to fit inside. The outside size is worked out for you."
            : "Enter the finished outside size of the box."}
        </FieldDescription>
      </Field>

      <DimensionInput
        id="box-w"
        label="Width"
        valueMm={inputs.dims.w}
        unit={unit}
        onChange={setDim("w")}
        description={SIZE_HINTS.w(unit)}
      />
      <DimensionInput
        id="box-d"
        label="Depth"
        valueMm={inputs.dims.d}
        unit={unit}
        onChange={setDim("d")}
        description={SIZE_HINTS.d(unit)}
      />
      <DimensionInput
        id="box-h"
        label="Height"
        valueMm={inputs.dims.h}
        unit={unit}
        onChange={setDim("h")}
        description={SIZE_HINTS.h(unit)}
      />

      {interior ? (
        <DimensionInput
          id="box-clearance"
          label="Clearance"
          valueMm={inputs.clearance}
          unit={unit}
          minMm={0}
          onChange={(mm) => onInputs({ clearance: mm })}
          description="Total slack added to each inside dimension."
        />
      ) : null}

      <Separator />

      <Field>
        <FieldLabel htmlFor="box-thickness">Plywood thickness</FieldLabel>
        <Select
          value={thicknessPreset}
          items={[
            ...THICKNESS_PRESETS.map((p) => ({ value: p.id, label: p.label })),
            { value: CUSTOM_THICKNESS, label: "Custom" },
          ]}
          onValueChange={(v) => v && onThicknessPreset(v)}
        >
          <SelectTrigger id="box-thickness" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THICKNESS_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_THICKNESS}>Custom</SelectItem>
          </SelectContent>
        </Select>
        <FieldDescription>Real thickness: {formatThickness(inputs.thickness, unit)}</FieldDescription>
      </Field>

      {thicknessPreset === CUSTOM_THICKNESS ? (
        <DimensionInput
          id="box-thickness-custom"
          label="Custom thickness"
          valueMm={inputs.thickness}
          unit={unit}
          onChange={(mm) => onInputs({ thickness: mm })}
        />
      ) : null}

      <Separator />

      <Field>
        <FieldTitle>Lid position</FieldTitle>
        <Choice<LidPosition>
          label="Lid position"
          value={inputs.lidPosition}
          onChange={onLidPosition}
          options={[
            { value: "top", label: "Top" },
            { value: "front", label: "Front" },
          ]}
        />
      </Field>

      <Field>
        <FieldTitle>Lid type</FieldTitle>
        <Choice<LidType>
          label="Lid type"
          value={inputs.lidType}
          onChange={(lidType) => onInputs({ lidType })}
          options={[
            { value: "full", label: "Full" },
            { value: "split", label: "Split" },
            { value: "half", label: "Half" },
          ]}
        />
        <FieldDescription>
          {inputs.lidType === "full"
            ? "One panel covers the whole opening."
            : inputs.lidType === "split"
              ? "Two equal leaves meet in the middle, and both open."
              : "One half is fixed, the other half opens."}
        </FieldDescription>
      </Field>

      {inputs.lidType === "half" ? (
        <Field>
          <FieldTitle>Opening half</FieldTitle>
          <Choice<LeafSide>
            label="Which half opens"
            value={inputs.openLeaf}
            onChange={(openLeaf) => onInputs({ openLeaf })}
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
      ) : null}

      <Separator />

      <Field>
        <FieldTitle>Legs</FieldTitle>
        <Choice<string>
          label="Face the legs attach to"
          size="sm"
          value={inputs.legs.face ?? "none"}
          onChange={(v) => onLegs({ face: v === "none" ? null : (v as Face) })}
          options={[
            { value: "none", label: "None" },
            ...LEG_FACES.map((face) => {
              const opt = faceOptions.find((o) => o.face === face)!
              return {
                value: face,
                label: FACE_LABEL[face],
                disabled: !opt.enabled,
                title: opt.reason,
              }
            }),
          ]}
        />
        <FieldDescription>Greyed-out faces are where the lid is.</FieldDescription>
      </Field>

      {hasLegs ? (
        <div className="grid grid-cols-3 gap-3">
          <DimensionInput
            id="leg-height"
            label="Leg height"
            valueMm={inputs.legs.height}
            unit={unit}
            onChange={(mm) => onLegs({ height: mm })}
          />
          <DimensionInput
            id="leg-section"
            label="Leg section"
            valueMm={inputs.legs.section}
            unit={unit}
            onChange={(mm) => onLegs({ section: mm })}
          />
          <DimensionInput
            id="leg-inset"
            label="Inset"
            valueMm={inputs.legs.inset}
            unit={unit}
            minMm={0}
            onChange={(mm) => onLegs({ inset: mm })}
          />
        </div>
      ) : null}
    </FieldGroup>
  )
}
