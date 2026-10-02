"use client"

import * as React from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Edges, Line, OrbitControls } from "@react-three/drei"
import { ExtrudeGeometry, Shape, Vector2, type BufferGeometry, type Group } from "three"

import {
  HINGE_COLOR,
  PART_COLORS,
  centerOf,
  defaultExplodeDistance,
  explodeOffset,
  partProgress,
  viewRadius,
  type BoxResult,
  type LidPosition,
  type Part,
  type Vec3,
} from "@/lib/box"

const FOV_DEG = 35
/** Length of the explode / collapse animation. */
const EXPLODE_SECONDS = 1.1
/** How quickly the camera glides to a new framing (higher = snappier). */
const CAMERA_EASE = 5
/** Default viewing direction (towards the camera from the box centre). */
const DEFAULT_VIEW_DIR: Vec3 = [0.75, 0.55, 1]
/** The hinge line sits this far (mm) inside the lid's inner face. */
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

/** A flat plate from a part's polygon outline, thickness centred on its mid-plane. */
function plateGeometry(part: Part): BufferGeometry {
  const shape = new Shape((part.outline ?? []).map(([x, y]) => new Vector2(x, y)))
  const geometry = new ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false })
  // Shape y becomes local z (across the width); the extrusion runs along local -y.
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, part.thickness / 2, 0)
  return geometry
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

  // Position follows the shared timeline every frame, staged per part type
  // (cheap, and it also places the part correctly on its first frame).
  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = partProgress(progress.current, part.type)
    g.position.set(offset[0] * p, offset[1] * p, offset[2] * p)
  })
  React.useEffect(() => invalidate(), [offset, invalidate])

  const plate = React.useMemo(() => (part.shape === "polygon" ? plateGeometry(part) : null), [part])
  React.useEffect(() => () => plate?.dispose(), [plate])

  const hinge = part.hinge
  return (
    <group ref={group}>
      <mesh position={part.center} rotation={part.shape === "polygon" ? part.rotation : undefined}>
        {part.shape === "cylinder" ? (
          <cylinderGeometry args={[part.width / 2, part.width / 2, part.length, 40]} />
        ) : plate ? (
          <primitive object={plate} attach="geometry" />
        ) : (
          <boxGeometry args={part.extents} />
        )}
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
          // Drawn through the lid so you can always see which edge hinges.
          depthTest={false}
          transparent
          opacity={0.85}
          renderOrder={10}
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
  // The hinge is on the lid's inside face, so nudge it inward (down for a top lid, back for a front lid).
  const hingeLift: Vec3 = lidPosition === "top" ? [0, -HINGE_LIFT_MM, 0] : [0, 0, -HINGE_LIFT_MM]

  // Run the shared timeline toward its target; render on demand only while moving.
  useFrame((_, delta) => {
    const target = exploded ? 1 : 0
    const t = progress.current
    if (t === target) return
    const step = delta / EXPLODE_SECONDS
    progress.current = target > t ? Math.min(target, t + step) : Math.max(target, t - step)
    invalidate()
  })

  const radius = viewRadius(result.bounds, exploded ? distance : 0)
  const lastResetKey = React.useRef(resetKey)
  const hasFramed = React.useRef(false)
  /** Where the camera is gliding to, or null when it's at rest / the user is steering. */
  const goal = React.useRef<{ pos: Vec3; target: Vec3 } | null>(null)

  // Re-fit the camera whenever the box changes size or moves (new legs, a
  // different lid, exploding). It keeps the angle you've orbited to; only
  // "Reset view" goes back to the default angle.
  React.useEffect(() => {
    const { camera } = getState()
    const reset = lastResetKey.current !== resetKey
    lastResetKey.current = resetKey
    const wasFramed = hasFramed.current
    const keepAngle = !reset && wasFramed
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
    const pos: Vec3 = [
      target[0] + (dir[0] / len) * dist,
      target[1] + (dir[1] / len) * dist,
      target[2] + (dir[2] / len) * dist,
    ]
    camera.near = dist / 100
    camera.far = dist * 20
    camera.updateProjectionMatrix()
    if (!wasFramed || !c) {
      // First frame: place the camera straight away.
      camera.position.set(...pos)
      c?.target.set(...target)
      c?.update()
      goal.current = null
    } else {
      goal.current = { pos, target }
    }
    invalidate()
  }, [radius, resetKey, result.bounds, getState, size.width, size.height, invalidate])

  // Glide the camera to its new framing; stop the moment the user grabs the view.
  useFrame(({ camera }, delta) => {
    const g = goal.current
    const c = controls.current
    if (!g || !c) return
    const k = 1 - Math.exp(-delta * CAMERA_EASE)
    let remaining = 0
    for (const a of [0, 1, 2] as const) {
      const key = (["x", "y", "z"] as const)[a]
      camera.position[key] += (g.pos[a] - camera.position[key]) * k
      c.target[key] += (g.target[a] - c.target[key]) * k
      remaining += Math.abs(g.pos[a] - camera.position[key]) + Math.abs(g.target[a] - c.target[key])
    }
    c.update()
    if (remaining < radius * 0.001) {
      camera.position.set(...g.pos)
      c.target.set(...g.target)
      c.update()
      goal.current = null
    }
    invalidate()
  })

  React.useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => {
      goal.current = null
    }
    c.addEventListener("start", stop)
    return () => c.removeEventListener("start", stop)
  }, [])

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
