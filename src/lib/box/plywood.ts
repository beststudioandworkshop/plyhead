/**
 * How many plies (layers) a sheet of plywood this thick typically has, for
 * drawing its edges. Plywood always has an odd number of plies so the grain
 * of the outer faces matches. Roughly one ply per 2.4 mm, so 6 mm plywood has
 * 3 plies, 12 mm has 7, and 18 mm has 9.
 */
export function plyCount(thicknessMm: number): number {
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) return 3
  const odd = 2 * Math.round(thicknessMm / 4.8) + 1
  return Math.min(21, Math.max(3, odd))
}
