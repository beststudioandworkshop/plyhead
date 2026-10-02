import type { KitRates, PriceBook } from "@/lib/box"

/**
 * Shop details and prices for the estimates. EDIT THESE.
 *
 * Everything below marked "example" is a placeholder I made up so the page has
 * numbers to show. Replace them with real prices, then set
 * `placeholderPrices` to false so the page stops calling them examples.
 */
export const SHOP = {
  name: "Wire",
  owner: "Will Reynolds",
  /**
   * Where build requests are emailed. Set NEXT_PUBLIC_QUOTE_EMAIL in Vercel
   * (Settings → Environment Variables) and redeploy. It ends up in the page, so
   * use an address you're happy to have public. Empty means "no address yet":
   * the form falls back to copying the request text.
   */
  email: process.env.NEXT_PUBLIC_QUOTE_EMAIL ?? "",
  currency: "USD",
  /** True while the prices below are examples. */
  placeholderPrices: true,
} as const

/** What it costs to buy the parts yourself (example prices). */
export const PRICES: PriceBook = {
  sheet: { "4x8": 85, "5x5": 95 },
  buttHingeEach: 4,
  continuousHingePerMeter: 14,
  lidStayEach: 6,
  lidSupportEach: 9,
  pullEach: 5,
  magneticCatchEach: 3,
  dowelEach: 8,
  legFastenerEach: 1.5,
  screwEach: 0.08,
  glue: 7,
  pilotBit: 12,
  finishAllowance: 20,
}

/** What a cut kit costs: cut to size, Domino joints, pilot holes, packed and shipped (example rates). */
export const KIT_RATES: KitRates = {
  perPartCut: 4,
  perDomino: 1.25,
  dominoSpacingMm: 150,
  dominosMinimum: 8,
  perPilotHole: 0.25,
  packing: 25,
  shipping: 45,
}

/** Hardware is an optional extra on a kit. */
export const KIT_INCLUDES_HARDWARE = false
