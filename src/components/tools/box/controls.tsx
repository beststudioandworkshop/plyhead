"use client"

import { Choice } from "./choice"
import { DimensionInput } from "./dimension-input"
import { SIZE_HINTS, pickHint, useTipSeed } from "./hints"
import { FieldGroup, Field, FieldLabel, FieldTitle, FieldDescription } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  THICKNESS_PRESETS,
  formatLength,
  formatThickness,
  lidAxes,
  type Axis,
  type BoxInputs,
  type DimensionMode,
  type Dims,
  type HingeSide,
  type LeafSide,
  type LegStyle,
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
  /** Exterior size in mm; used to describe the lid's edges. */
  exterior: Dims
  onLegs: (patch: Partial<BoxInputs["legs"]>) => void
}

/** Names for the two halves of a split lid, by the axis they split across. */
const LEAF_LABELS: Record<Axis, [string, string]> = {
  0: ["Left", "Right"],
  1: ["Bottom", "Top"],
  2: ["Back", "Front"],
}

export function Controls({ state, exterior, onUnit, onMode, onInputs, onThicknessPreset, onLegs }: ControlsProps) {
  const { inputs, unit, thicknessPreset } = state
  const tipSeed = useTipSeed()
  const interior = inputs.dimensionMode === "interior"
  const legStyle = inputs.legs.style
  // Lid size in the x/y/z frame; only the two in-plane axes matter.
  const lid = lidAxes([exterior.w, exterior.h, exterior.d], inputs.lidPosition, inputs.hingeSide)
  const [firstLeaf, secondLeaf] = LEAF_LABELS[lid.crossAxis]
  const lidEdges = {
    long: Math.max(lid.hingeLength, lid.crossLength),
    short: Math.min(lid.hingeLength, lid.crossLength),
  }

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
        description={pickHint(SIZE_HINTS.w, tipSeed, 0, unit)}
      />
      <DimensionInput
        id="box-d"
        label="Depth"
        valueMm={inputs.dims.d}
        unit={unit}
        onChange={setDim("d")}
        description={pickHint(SIZE_HINTS.d, tipSeed, 1, unit)}
      />
      <DimensionInput
        id="box-h"
        label="Height"
        valueMm={inputs.dims.h}
        unit={unit}
        onChange={setDim("h")}
        description={pickHint(SIZE_HINTS.h, tipSeed, 2, unit)}
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
          onChange={(lidPosition) => onInputs({ lidPosition })}
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

      <Field>
        <FieldTitle>Hinge side</FieldTitle>
        <Choice<HingeSide>
          label="Hinge side"
          value={inputs.hingeSide}
          onChange={(hingeSide) => onInputs({ hingeSide })}
          options={[
            { value: "long", label: "Long" },
            { value: "short", label: "Short" },
          ]}
        />
        <FieldDescription>
          The hinge runs along the {formatLength(lidEdges[inputs.hingeSide], unit)} edge of the lid.
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
              { value: "first", label: firstLeaf },
              { value: "second", label: secondLeaf },
            ]}
          />
        </Field>
      ) : null}

      <Separator />

      <Field>
        <FieldTitle>Legs</FieldTitle>
        <Choice<LegStyle>
          label="Leg style"
          value={legStyle}
          onChange={(style) => onLegs({ style })}
          options={[
            { value: "none", label: "None" },
            { value: "dowel", label: "Dowels" },
            { value: "tapered", label: "Tapered" },
          ]}
        />
        <FieldDescription>
          {legStyle === "none"
            ? "Sits flat on the floor."
            : legStyle === "dowel"
              ? "Four thick round dowels that screw into the bottom."
              : "Two plywood plates per corner, joined in an L and narrowing toward the floor. They screw up into the bottom."}
        </FieldDescription>
      </Field>

      {legStyle !== "none" ? (
        <div className="grid grid-cols-3 gap-3">
          <DimensionInput
            id="leg-height"
            label="Leg height"
            valueMm={inputs.legs.height}
            unit={unit}
            onChange={(mm) => onLegs({ height: mm })}
          />
          {legStyle === "dowel" ? (
            <>
              <DimensionInput
                id="leg-diameter"
                label="Diameter"
                valueMm={inputs.legs.diameter}
                unit={unit}
                onChange={(mm) => onLegs({ diameter: mm })}
              />
              <DimensionInput
                id="leg-inset"
                label="Inset"
                valueMm={inputs.legs.inset}
                unit={unit}
                minMm={0}
                onChange={(mm) => onLegs({ inset: mm })}
              />
            </>
          ) : (
            <>
              <DimensionInput
                id="leg-width"
                label="Top width"
                valueMm={inputs.legs.width}
                unit={unit}
                onChange={(mm) => onLegs({ width: mm })}
              />
              <DimensionInput
                id="leg-foot"
                label="Foot width"
                valueMm={inputs.legs.footWidth}
                unit={unit}
                onChange={(mm) => onLegs({ footWidth: mm })}
              />
            </>
          )}
        </div>
      ) : null}
    </FieldGroup>
  )
}
