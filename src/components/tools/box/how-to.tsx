"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  MAX_BITE_MM,
  dividerWord,
  lidWord,
  MIN_BITE_MM,
  PILOT_HOLE_MM,
  estimateJointLength,
  formatLength,
  formatThickness,
  screwAdvice,
  screwCount,
  type BoxInputs,
  type Dims,
  type ScrewAdvice,
  type ScrewTierAdvice,
  type Unit,
} from "@/lib/box"

const fraction = (inches: number) => {
  const whole = Math.floor(inches)
  const rem = Math.round((inches - whole) * 16)
  const frac = rem === 0 ? "" : rem % 8 === 0 ? "1/2" : rem % 4 === 0 ? `${rem / 4}/4` : rem % 2 === 0 ? `${rem / 2}/8` : `${rem}/16`
  return [whole || "", frac].filter(Boolean).join(" ") + '"'
}

export function HowTo({ inputs, exterior, unit }: { inputs: BoxInputs; exterior: Dims; unit: Unit }) {
  const t = inputs.thickness
  const screw = screwAdvice(t)
  const imperial = unit === "in"
  const screwOf = (tier: ScrewTierAdvice) =>
    imperial ? `${screw.gauge} × ${fraction(tier.lengthIn)}` : `${screw.gauge} × ${tier.lengthMetricMm} mm`
  // The legs and general joints use the "good" tier as the baseline.
  const screwText = screwOf(screw.good)
  const jointLength = estimateJointLength(exterior, inputs.lidPosition, inputs.dividers)
  const tiers: { id: "good" | "better"; label: string; tier: ScrewAdvice["good"] }[] = [
    { id: "good", label: "Good", tier: screw.good },
    { id: "better", label: "Better", tier: screw.better },
  ]
  const lap = inputs.bottomStyle === "lap"
  const lw = lidWord(inputs.lidPosition)
  const dw = dividerWord(inputs.lidPosition)
  const top = inputs.lidPosition === "top"
  const hasLid = inputs.lidType !== "none"
  const legs = inputs.legs.style

  return (
    <Card className="card-tone tone-red">
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
                Screw length is a <strong>minimum</strong>. Quantity matters just as much: more screws, evenly
                spaced, hold a joint better than a few long ones. For {formatThickness(t, unit)} plywood, use
                {" "}{screw.gauge} wood or construction screws (self-tapping, flat or trim head), and aim for one of
                these:
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    {tiers.map((x) => (
                      <TableHead key={x.id}>{x.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableHead>Bite into the second panel</TableHead>
                    {tiers.map((x) => (
                      <TableCell key={x.id}>{formatLength(x.tier.biteMm, unit)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead>Screw (at least)</TableHead>
                    {tiers.map((x) => (
                      <TableCell key={x.id}>{screwOf(x.tier)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead>A screw about every</TableHead>
                    {tiers.map((x) => (
                      <TableCell key={x.id}>{formatLength(x.tier.spacingMm, unit)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead>For this box, about</TableHead>
                    {tiers.map((x) => (
                      <TableCell key={x.id}>{screwCount(jointLength, x.tier.spacingMm)} screws</TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
              <p>
                Each screw goes through the first panel and into the edge of the second. The count is a rough
                estimate for the main joints and doesn&apos;t include the lid hinges or the legs.
              </p>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableHead>Bite fence</TableHead>
                    <TableCell className="whitespace-normal">
                      Never less than {formatLength(MIN_BITE_MM, unit)}, and never more than{" "}
                      {formatLength(MAX_BITE_MM, unit)}. Past that, a screw risks breaking through the side.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Pilot hole</TableHead>
                    <TableCell>{formatLength(PILOT_HOLE_MM, unit)}, every time</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Countersink</TableHead>
                    <TableCell className="whitespace-normal">
                      Really worth it on a project like this: the heads sit flush.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Keep screws in from the corners</TableHead>
                    <TableCell>{formatLength(19, unit)} or more</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p>Always drill pilot holes in plywood edges, or the layers split.</p>
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
                {inputs.dividers > 0 ? <li>Fit the {dw === "shelf" ? "shelves" : "dividers"} and screw through the outside walls into their edges.</li> : null}
                {hasLid ? (
                <li>
                  Fit the {lw} last: hinge it on the {inputs.hingeSide} edge, on the inside face, and check it opens
                  freely before you tighten everything.
                </li>
                ) : null}
                {legs !== "none" ? <li>Finally, attach the legs (see below).</li> : null}
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="finish">
            <AccordionTrigger>Finishes</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <p>
                A quick note on words: <strong>stain</strong> is color, a <strong>top coat</strong> is the
                protector, and <strong>finish</strong> is the general term that covers both.
              </p>
              <ul className="list-disc pl-5">
                <li>
                  <strong>Paint.</strong> The forgiving choice, and it hides the plywood. Prime first (the edges
                  drink it up) and sand lightly between coats.
                </li>
                <li>
                  <strong>Water-based poly or hard wax oil</strong> for nice veneers. Watch out for pine, which
                  yellows. Oil-based finishes add to that warm shift, so water-based poly is the safe pick if you
                  want the wood to stay light.
                </li>
                <li>
                  <strong>Paste wax</strong>, my favorite. Apply it patiently in thin coats, let it haze, then buff
                  and wipe. The more layers you build now, the longer this thing will love you back.
                </li>
                <li>
                  <strong>Stain.</strong> Skip it unless you are licensed for that kind of thing (kidding, but test
                  on a scrap first: pine and thin veneers blotch).
                </li>
              </ul>
              <p>
                Sand before you finish, and keep finish off any surface that is going to be glued, because glue
                won&apos;t hold on it. Let a coat harden for a few days before anyone sits on the box or stacks
                things on it.
              </p>
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

          {hasLid ? (
          <AccordionItem value="seat">
            <AccordionTrigger>Sitting on it? Add a cushion</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <p>
                A box makes a good seat, and a cushion makes it a comfortable one. A 2 to 3 inch foam cushion on a
                box about 15 inches tall puts you at a good seat height.
              </p>
              <ul className="list-disc pl-5">
                <li>
                  Cut the foam to the size of the top ({formatLength(inputs.dims.w, unit)} wide at most) so it doesn&apos;t
                  overhang.
                </li>
                <li>Use the lapped bottom, glue every joint{top ? ", and add a divider if the lid is long or split" : ""}.</li>
                <li>A non-slip pad or velcro strip keeps the cushion from sliding off.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          ) : null}
        </Accordion>
      </CardContent>
    </Card>
  )
}
