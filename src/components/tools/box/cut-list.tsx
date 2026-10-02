"use client"

import * as React from "react"
import { CopyIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cutListToCsv, cutListToText, formatRow, type CutListRow, type Unit } from "@/lib/box"

export function CutList({ rows, unit, rounded }: { rows: CutListRow[]; unit: Unit; rounded: boolean }) {
  const total = rows.reduce((n, r) => n + r.quantity, 0)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cutListToText(rows, unit))
      toast.success("Cut list copied")
    } catch {
      toast.error("Couldn't copy. Select the table text instead.")
    }
  }

  const download = () => {
    const blob = new Blob([cutListToCsv(rows, unit)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "plywood-box-cut-list.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cut list</CardTitle>
        <CardDescription>
          {total} pieces. Sizes are length × width × thickness
          {rounded
            ? unit === "in"
              ? ', rounded to the nearest 1/8"'
              : ", rounded to the nearest mm"
            : unit === "in"
              ? ', shown to the nearest 1/16"'
              : ""}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <CopyIcon data-icon="inline-start" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <DownloadIcon data-icon="inline-start" />
            Download CSV
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead className="text-right">Width</TableHead>
              <TableHead className="text-right">Thick</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const c = formatRow(row, unit)
              return (
                <TableRow key={row.partIds.join()}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.width}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.thickness}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
