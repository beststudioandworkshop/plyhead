"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import { MM_PER_INCH, formatLength, formatThickness, screwAdvice, type BoxInputs, type Unit } from "@/lib/box"

const fraction = (inches: number) => {
  const whole = Math.floor(inches)
  const rem = Math.round((inches - whole) * 16)
  const frac = rem === 0 ? "" : rem % 8 === 0 ? "1/2" : rem % 4 === 0 ? `${rem / 4}/4` : rem % 2 === 0 ? `${rem / 2}/8` : `${rem}/16`
  return [whole || "", frac].filter(Boolean).join(" ") + '"'
}

export function HowTo({ inputs, unit }: { inputs: BoxInputs; unit: Unit }) {
  const t = inputs.thickness
  const screw = screwAdvice(t)
  const imperial = unit === "in"
  const screwText = imperial ? `${screw.gauge} × ${fraction(screw.lengthIn)}` : `${screw.gauge} × ${screw.lengthMetricMm} mm`
  const lap = inputs.bottomStyle === "lap"
  const legs = inputs.legs.style

  return (
    <Card>
      <CardHeader>
        <CardTitle>How to put it together</CardTitle>
        <CardDescription>
          Rules of thumb for {formatThickness(t, unit)} plywood. When in doubt, test on a scrap first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion defaultValue={["screws"]}>
          <AccordionItem value="screws">
            <AccordionTrigger>Screws</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <p>
                For your {formatThickness(t, unit)} plywood, use <strong>{screwText}</strong> wood or construction
                screws (self-tapping, flat or trim head). A screw should go through the first panel and bite at
                least {imperial ? '1"' : "25 mm"} into the edge of the second, so the length is the panel thickness
                plus that bite, rounded up to a stock size.
              </p>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableHead>Pilot hole in the second panel</TableHead>
                    <TableCell>{imperial ? fraction(screw.pilotMm / MM_PER_INCH) : `${screw.pilotMm} mm`}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Clearance hole in the first panel</TableHead>
                    <TableCell>
                      {imperial ? fraction(screw.clearanceMm / MM_PER_INCH) : `${screw.clearanceMm} mm`}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Space between screws</TableHead>
                    <TableCell>
                      {formatLength(screw.spacingMm[0], unit)} to {formatLength(screw.spacingMm[1], unit)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Keep screws in from the corners</TableHead>
                    <TableCell>{formatLength(19, unit)} or more</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p>
                Always drill pilot holes in plywood edges, or the layers split. Countersink so the heads sit flush.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="glue">
            <AccordionTrigger>Glue</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <p>
                Use yellow wood glue (Titebond II or similar). Glue and screws together make a joint far stronger
                than either alone, and the screws act as clamps while it dries.
              </p>
              <ul className="list-disc pl-5">
                <li>Dry-fit everything first, with no glue, to make sure it all lines up.</li>
                <li>
                  Plywood edges soak up glue. Brush a thin coat on first, let it sink in for a minute, then add a
                  second coat and join.
                </li>
                <li>A thin even layer is better than a thick bead. Wipe squeeze-out with a damp rag right away.</li>
                <li>Leave it clamped or screwed for an hour, and let it cure a full day before it takes any load.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="order">
            <AccordionTrigger>Order of assembly</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5">
                {lap ? (
                  <>
                    <li>Lay the bottom flat. Glue and screw the sides down onto it from underneath.</li>
                    <li>Add the back{inputs.lidPosition === "top" ? " and front" : ""}, between the sides.</li>
                  </>
                ) : (
                  <>
                    <li>Join the sides to the back{inputs.lidPosition === "top" ? " and front" : ""}, checking the corners are square.</li>
                    <li>Glue and screw the bottom in from the outside, flush with the lower edges.</li>
                  </>
                )}
                {inputs.lidPosition === "front" ? <li>Add the top panel between the sides.</li> : null}
                {inputs.dividers > 0 ? <li>Fit the dividers and screw through the outside walls into their edges.</li> : null}
                <li>
                  Fit the lid last: hinge it on the {inputs.hingeSide} edge, on the inside face, and check it opens
                  freely before you tighten everything.
                </li>
                {legs !== "none" ? <li>Finally, attach the legs (see below).</li> : null}
              </ol>
            </AccordionContent>
          </AccordionItem>

          {legs !== "none" ? (
            <AccordionItem value="legs">
              <AccordionTrigger>Fitting the legs</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                {legs === "dowel" ? (
                  <p>
                    Drill a pilot hole into the end of each dowel and screw up through the bottom panel with a
                    screw about {imperial ? '2 1/2"' : "60 mm"} long, with glue on the dowel end. Round-over the
                    bottom of each dowel so it doesn&apos;t splinter on the floor.
                  </p>
                ) : (
                  <p>
                    Glue and screw each pair of plates into an L first, then screw up through the bottom panel
                    into the top edge of each plate with {screwText} screws. Two screws per plate keeps the leg
                    from twisting. The long edge of each plate faces the corner of the box.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ) : null}

          <AccordionItem value="seat">
            <AccordionTrigger>Sitting on it? Add a cushion</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <p>
                A box makes a good seat, and a cushion makes it a comfortable one. A 2 to 3 inch foam cushion on a
                box about 15 inches tall puts you at a good seat height.
              </p>
              <ul className="list-disc pl-5">
                <li>
                  Cut the foam to the lid size ({formatLength(inputs.dims.w, unit)} wide at most) so it doesn&apos;t
                  overhang.
                </li>
                <li>Use the lapped bottom, glue every joint, and add a divider if the lid is long or split.</li>
                <li>A non-slip pad or velcro strip keeps the cushion from sliding off.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
