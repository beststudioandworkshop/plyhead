import type { Metadata } from "next"

import { BoxConfigurator } from "@/components/tools/box/box-configurator"

export const metadata: Metadata = { title: "Plywood box" }

export default function BoxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Plywood box</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Work out the sizes you need for a simple plywood box. Butt joints, overlay lid.
        </p>
      </div>
      <BoxConfigurator />
    </div>
  )
}
