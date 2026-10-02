"use client"

import * as React from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Edges, Line, OrbitControls } from "@react-three/drei"
import type { Group } from "three"

import {
  HINGE_COLOR,
  PART_COLORS,
  centerOf,
  defaultExplodeDistance,
  explodeOffset,
  viewRadius,
  type BoxResult,
  type LidPosition,
  type Part,
  type Vec3,
} from "@/lib/box"

const FOV_DEG = 35
/** Default viewing direction (towards the camera from the box centre). */
const DEFAULT_VIEW_DIR: Vec3 = [0.75, 0.55, 1]
/** The hinge line floats this far (mm) off the lid surface so it isn't swallowed by it. */
const HINGE_LIFT_MM = 1.5
/** The 3D view's colours can't come from CSS tokens; see lib/box/part-colors.ts. */
const EDGE_LIGHT = "hsl(0, 0%, 12%)"
const EDGE_DARK = "hsl(0, 0%, 90%)"

interface SceneProps {
  result: BoxResult
  lidPosition: LidPosition
  exploded: boolean
  resetKey: number
  dark: boolean
}

function PartMesh({
  part,
  offset,
  progress,
  edgeColor,
  hingeLift,
}: {
  part: Part
  offset: Vec3
  progress: React.RefObject<number>
  edgeColor: string
  hingeLift: Vec3
}) {
  const group = React.useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)

  // Position follows the shared explode progress every frame (cheap, and it
  // also places the part correctly on its first frame).
  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = progress.current
    g.position.set(offset[0] * p, offset[1] * p, offset[2] * p)
  })
  React.useEffect(() => invalidate(), [offset, invalidate])

  const hinge = part.hinge
  return (
    <group ref={group}>
      <mesh position={part.center}>
        <boxGeometry args={part.extents} />
        <meshStandardMaterial color={PART_COLORS[part.type]} roughness={0.75} metalness={0} />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      {hinge ? (
        <Line
          points={[
            [hinge.from[0] + hingeLift[0], hinge.from[1] + hingeLift[1], hinge.from[2] + hingeLift[2]],
            [hinge.to[0] + hingeLift[0], hinge.to[1] + hingeLift[1], hinge.to[2] + hingeLift[2]],
          ]}
          color={HINGE_COLOR}
          lineWidth={4}
        />
      ) : null}
    </group>
  )
}

function Scene({ result, lidPosition, exploded, resetKey, dark }: SceneProps) {
  const progress = React.useRef(0)
  const controls = React.useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const getState = useThree((s) => s.get)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  const boxCenter = React.useMemo(
    () => [result.exterior.w / 2, result.exterior.h / 2, result.exterior.d / 2] as Vec3,
    [result.exterior],
  )
  const distance = React.useMemo(() => defaultExplodeDistance(result.exterior), [result.exterior])
  const offsets = React.useMemo(
    () => result.parts.map((p) => explodeOffset(p, boxCenter, distance)),
    [result.parts, boxCenter, distance],
  )
  const hingeLift: Vec3 = lidPosition === "top" ? [0, HINGE_LIFT_MM, 0] : [0, 0, HINGE_LIFT_MM]

  // Ease the explode progress toward its target; render on demand only while moving.
  useFrame((_, delta) => {
    const target = exploded ? 1 : 0
    const diff = target - progress.current
    if (Math.abs(diff) < 0.001) {
      if (progress.current !== target) progress.current = target
      return
    }
    progress.current += diff * Math.min(1, delta * 8)
    invalidate()
  })

  const radius = viewRadius(result.bounds, exploded ? distance : 0)
  const lastResetKey = React.useRef(resetKey)
  const hasFramed = React.useRef(false)

  // Re-fit the camera whenever the box changes size or moves (new legs, a
  // different lid, exploding). It keeps the angle you've orbited to; only
  // "Reset view" goes back to the default angle.
  React.useEffect(() => {
    const { camera } = getState()
    const reset = lastResetKey.current !== resetKey
    lastResetKey.current = resetKey
    const keepAngle = !reset && hasFramed.current
    hasFramed.current = true

    const target = centerOf(result.bounds)
    const c = controls.current
    let dir: Vec3 = DEFAULT_VIEW_DIR
    if (keepAngle && c) {
      const current: Vec3 = [
        camera.position.x - c.target.x,
        camera.position.y - c.target.y,
        camera.position.z - c.target.z,
      ]
      if (Math.hypot(...current) > 1e-6) dir = current
    }
    const vFov = (FOV_DEG * Math.PI) / 180
    const aspect = size.width / Math.max(size.height, 1)
    // Fit the bounding sphere in the narrower of the two view angles.
    const fit = Math.min(vFov, 2 * Math.atan(Math.tan(vFov / 2) * aspect))
    const dist = (radius / Math.sin(fit / 2)) * 1.05
    const len = Math.hypot(...dir)
    camera.position.set(
      target[0] + (dir[0] / len) * dist,
      target[1] + (dir[1] / len) * dist,
      target[2] + (dir[2] / len) * dist,
    )
    camera.near = dist / 100
    camera.far = dist * 20
    camera.updateProjectionMatrix()
    if (c) {
      c.target.set(...target)
      c.update()
    }
    invalidate()
  }, [radius, resetKey, result.bounds, getState, size.width, size.height, invalidate])

  const edgeColor = dark ? EDGE_DARK : EDGE_LIGHT

  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["hsl(0, 0%, 100%)", "hsl(0, 0%, 35%)", 0.5]} />
      <directionalLight position={[radius * 2, radius * 3, radius * 2.5]} intensity={1.3} />
      <directionalLight position={[-radius * 2, radius, -radius * 2]} intensity={0.4} />
      {result.parts.map((part, i) => (
        <PartMesh
          key={part.id}
          part={part}
          offset={offsets[i]}
          progress={progress}
          edgeColor={edgeColor}
          hingeLift={hingeLift}
        />
      ))}
      <OrbitControls ref={controls} makeDefault enableDamping={false} maxPolarAngle={Math.PI * 0.98} />
    </>
  )
}

export default function BoxScene(props: SceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: FOV_DEG, position: [0, 0, 1000] }}
      aria-label="3D preview of the box. Drag to rotate, scroll or pinch to zoom."
      role="img"
    >
      <Scene {...props} />
    </Canvas>
  )
}
