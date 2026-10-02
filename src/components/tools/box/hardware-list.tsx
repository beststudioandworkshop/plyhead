"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { HardwareItem, ToolItem } from "@/lib/box"

const CATEGORY_LABEL: Record<HardwareItem["category"], string> = {
  hinges: "Hinges",
  lid: "Lid or door",
  legs: "Legs",
  fasteners: "Fasteners",
  supplies: "Supplies",
}

export function HardwareList({ items, tools }: { items: HardwareItem[]; tools: ToolItem[] }) {
  return (
    <Card className="card-tone tone-pink">
      <CardHeader>
        <CardTitle>What you&apos;ll need</CardTitle>
        <CardDescription>
          Hardware and supplies to buy besides the plywood, then the tools that make it go smoothly. Sizes are a good
          starting point, so match them to what your supplier has.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <h3 className="mb-2 font-medium">Hardware and supplies</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-normal">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground">
                    {CATEGORY_LABEL[item.category]} · {item.spec}
                  </div>
                  {item.note ? <div className="mt-0.5 text-xs text-muted-foreground">{item.note}</div> : null}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{item.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h3 className="mt-6 mb-2 font-medium">Tools that help</h3>
        <ul className="flex flex-col gap-3">
          {tools.map((tool) => (
            <li key={tool.id}>
              <div className="font-medium">
                {tool.name}
                {tool.essential ? null : <span className="font-normal text-muted-foreground"> (nice to have)</span>}
              </div>
              <div className="text-sm text-muted-foreground">{tool.why}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
