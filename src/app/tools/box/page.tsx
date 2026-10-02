import type { Metadata } from "next"

import { BoxConfigurator } from "@/components/tools/box/box-configurator"
import { decodeShare } from "@/lib/box"

export const metadata: Metadata = { title: "Plywood box" }

export default async function BoxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // A shared link carries the whole design in ?d=. Anything invalid is ignored.
  const d = (await searchParams).d
  const initial = decodeShare(Array.isArray(d) ? d[0] : d)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Plywood box</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Work out the sizes you need for a simple plywood box. Butt joints, overlay lid.
        </p>
      </div>
      <BoxConfigurator initial={initial ?? undefined} />
    </div>
  )
}
