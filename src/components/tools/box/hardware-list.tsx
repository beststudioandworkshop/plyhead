"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { HardwareItem } from "@/lib/box"

const CATEGORY_LABEL: Record<HardwareItem["category"], string> = {
  hinges: "Hinges",
  lid: "Lid",
  legs: "Legs",
  fasteners: "Fasteners",
  supplies: "Supplies",
}

export function HardwareList({ items }: { items: HardwareItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hardware</CardTitle>
        <CardDescription>
          What to buy besides the plywood. Sizes are a good starting point, so match them to what your supplier has.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
