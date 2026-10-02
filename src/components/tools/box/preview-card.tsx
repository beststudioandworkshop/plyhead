"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { RotateCcwIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Choice } from "./choice"
import type { Surface } from "./box-scene"
import { HINGE_COLOR, PART_COLORS, hatchSwatch, partTypeLabel, type BoxResult, type LidPosition, type PartType } from "@/lib/box"

const BoxScene = dynamic(() => import("./box-scene"), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
})

const LEGEND_ORDER: PartType[] = ["side", "front", "back", "top", "bottom", "divider", "lid", "leg"]

export function PreviewCard({ result, lidPosition }: { result: BoxResult; lidPosition: LidPosition }) {
  const { resolvedTheme } = useTheme()
  const [exploded, setExploded] = React.useState(false)
  const [surface, setSurface] = React.useState<Surface>("hatch")
  const [opened, setOpened] = React.useState(false)
  const [resetKey, setResetKey] = React.useState(0)

  const present = new Set(result.parts.map((p) => p.type))
  const hasHinge = result.parts.some((p) => p.hinge)

  return (
    <Card className="card-tone tone-sky lg:col-start-2">
      <CardHeader>
        <CardTitle>3D preview</CardTitle>
        <CardDescription>Drag to rotate. Scroll or pinch to zoom.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="h-72 overflow-hidden rounded-lg border border-border bg-muted/40 sm:h-96 lg:h-[26rem]">
          {result.ok ? (
            <BoxScene
              result={result}
              lidPosition={lidPosition}
              exploded={exploded}
              resetKey={resetKey}
              surface={surface}
              opened={opened}
              dark={resolvedTheme === "dark"}
            />
          ) : (
            <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Fix the settings to see the box.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Label className="gap-2">
              <Switch checked={exploded} onCheckedChange={setExploded} />
              Exploded view
            </Label>
            <Label className="gap-2">
              <Switch checked={opened} onCheckedChange={setOpened} />
              {lidPosition === "front" ? "Open the door" : "Open the lid"}
            </Label>
          </div>
          <Choice<Surface>
            label="Surface"
            size="sm"
            className="w-fit"
            value={surface}
            onChange={setSurface}
            options={[
              { value: "solid", label: "Solid" },
              { value: "hatch", label: "Hatch" },
              { value: "grain", label: "Grain" },
            ]}
          />
          <Button variant="outline" size="sm" onClick={() => setResetKey((k) => k + 1)}>
            <RotateCcwIcon data-icon="inline-start" />
            Reset view
          </Button>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {LEGEND_ORDER.filter((t) => present.has(t)).map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 rounded-sm border border-border"
                style={{ backgroundImage: hatchSwatch(PART_COLORS[t]) }}
              />
              {partTypeLabel(t, lidPosition)}
            </li>
          ))}
          {hasHinge ? (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1 w-4 rounded-full border border-border"
                style={{ backgroundColor: HINGE_COLOR }}
              />
              Hinge (inside the lid)
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  )
}
