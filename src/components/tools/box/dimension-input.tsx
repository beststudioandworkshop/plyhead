"use client"

import * as React from "react"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatLength, parseLength, type Unit } from "@/lib/box"

interface DimensionInputProps {
  id: string
  label: string
  /** Current value in mm. */
  valueMm: number
  unit: Unit
  onChange: (mm: number) => void
  /** Smallest accepted value in mm (inclusive). Use 0 to allow zero. Default: just above 0. */
  minMm?: number
  description?: string
}

/**
 * Text input that accepts fractions ("1 1/2", "3/4") or decimals, in the
 * chosen unit. Valid values are pushed up as you type; the field only
 * reformats on blur so it doesn't fight the cursor.
 */
export function DimensionInput({ id, label, valueMm, unit, onChange, minMm, description }: DimensionInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const [invalid, setInvalid] = React.useState(false)

  const accepts = (mm: number | null): mm is number =>
    mm !== null && (minMm === undefined ? mm > 0 : mm >= minMm)

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="text"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        value={draft ?? formatLength(valueMm, unit, false)}
        onChange={(e) => {
          const text = e.target.value
          setDraft(text)
          const mm = parseLength(text, unit)
          if (accepts(mm)) {
            setInvalid(false)
            onChange(mm)
          } else {
            setInvalid(true)
          }
        }}
        onBlur={() => {
          if (!invalid) setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !invalid) {
            setDraft(null)
            e.currentTarget.blur()
          }
        }}
      />
      {invalid ? (
        <FieldError>Enter a number like 12, 3/4 or 1 1/2{unit === "in" ? ' (inches)' : " (mm)"}.</FieldError>
      ) : description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
    </Field>
  )
}
