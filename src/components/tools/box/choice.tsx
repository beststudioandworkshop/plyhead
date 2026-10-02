"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
  title?: string
}

interface ChoiceProps<T extends string> {
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
  size?: "default" | "sm"
}

/** Single-select segmented control. Clicking the active item does nothing. */
export function Choice<T extends string>({ value, options, onChange, label, className, size }: ChoiceProps<T>) {
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      size={size}
      aria-label={label}
      className={className ?? "w-full flex-wrap"}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined
        if (picked) onChange(picked)
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.title}
          className="flex-1"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
