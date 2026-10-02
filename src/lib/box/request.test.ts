import { describe, expect, it } from "vitest"

import { buildBox } from "./build"
import { requestBody, requestMailto, requestSubject, type RequestArgs } from "./request"
import { inToMm } from "./units"
import type { BoxInputs } from "./types"

const inputs: BoxInputs = {
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: inToMm(0.71),
  lidPosition: "top",
  lidType: "split",
  openLeaf: "second",
  hingeSide: "long",
  bottomStyle: "lap",
  dividers: 1,
  legs: { style: "tapered", height: 101.6, diameter: 38.1, inset: 12.7, width: 76.2, footWidth: 38.1 },
  joinery: "butt",
}
const result = buildBox(inputs)

const args = (over: Partial<RequestArgs> = {}): RequestArgs => ({
  kind: "kit",
  contact: { name: "Sam Maker", email: "sam@example.com", zip: "97201", notes: "Birch, please." },
  inputs,
  exterior: result.exterior,
  interior: result.interior,
  unit: "in",
  link: "https://example.com/tools/box?d=abc",
  estimate: { total: "$214.50", example: true },
  ...over,
})

describe("build request text", () => {
  it("subject names the box size and the person", () => {
    const s = requestSubject(args())
    expect(s).toContain('18" × 12" × 10"')
    expect(s).toContain("Sam Maker")
  })

  it("subject works without a name", () => {
    expect(requestSubject(args({ contact: { name: "", email: "", zip: "", notes: "" } }))).not.toContain("()")
  })

  it("body carries the contact details, the design, the estimate and the link", () => {
    const b = requestBody(args())
    expect(b).toContain("Sam Maker")
    expect(b).toContain("sam@example.com")
    expect(b).toContain("97201")
    expect(b).toContain("Lid: top, split, hinged on the long side")
    expect(b).toContain("Bottom: under the walls")
    expect(b).toContain("Dividers: 1")
    expect(b).toContain("tapered plywood corners")
    expect(b).toContain("$214.50 (example prices)")
    expect(b).toContain("https://example.com/tools/box?d=abc")
    expect(b).toContain("Birch, please.")
  })

  it("marks missing contact fields and omits empty notes", () => {
    const b = requestBody(args({ contact: { name: "", email: "", zip: "", notes: "   " } }))
    expect(b).toContain("Name: (not given)")
    expect(b).not.toContain("NOTES")
  })

  it("truncates very long notes", () => {
    const b = requestBody(args({ contact: { name: "A", email: "", zip: "", notes: "x".repeat(5000) } }))
    expect(b.length).toBeLessThan(2000)
  })

  it("uses mm when asked", () => {
    expect(requestBody(args({ unit: "mm" }))).toContain("457.2 mm")
  })

  it("mailto is null without an address, and a valid encoded URL with one", () => {
    expect(requestMailto("", args())).toBeNull()
    expect(requestMailto("   ", args())).toBeNull()
    const url = requestMailto("will@example.com", args())!
    expect(url.startsWith("mailto:will@example.com?subject=")).toBe(true)
    const params = new URLSearchParams(url.split("?")[1])
    expect(params.get("subject")).toBe(requestSubject(args()))
    expect(params.get("body")).toBe(requestBody(args()))
    expect(url.length).toBeLessThan(3500)
  })

  it("omits the estimate line when there isn't one", () => {
    expect(requestBody(args({ estimate: undefined }))).not.toContain("Estimate shown")
  })
})
