"use client"

import * as React from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Edges, Line, OrbitControls } from "@react-three/drei"
import { Color, ExtrudeGeometry, Shape, Vector2, Vector3, type BufferGeometry, type Group, type WebGLProgramParametersWithUniforms } from "three"

import {
  GRAIN_DARK,
  GRAIN_LIGHT,
  HINGE_COLOR,
  PART_COLORS,
  UNIVERSAL_COLOR,
  centerOf,
  defaultExplodeDistance,
  explodeOffset,
  openProgress,
  openSpecs,
  partProgress,
  viewRadius,
  type BoxResult,
  type LidPosition,
  type OpenSpec,
  type Part,
  type Vec3,
} from "@/lib/box"

const FOV_DEG = 35
/** Length of the explode / collapse animation. */
const EXPLODE_SECONDS = 1.1
/** Length of the open / close animation. */
const OPEN_SECONDS = 1.2
/** How quickly the camera glides to a new framing (higher = snappier). */
const CAMERA_EASE = 5
/** Default viewing direction (towards the camera from the box centre). */
const DEFAULT_VIEW_DIR: Vec3 = [0.75, 0.55, 1]
/** The hinge line sits this far (mm) inside the lid's inner face. */
const HINGE_LIFT_MM = 1.5
/** The 3D view's colours can't come from CSS tokens; see lib/box/part-colors.ts. */
const EDGE_LIGHT = "hsl(0, 0%, 12%)"
const EDGE_DARK = "hsl(0, 0%, 90%)"

export type Surface = "solid" | "hatch" | "grain"

interface SceneProps {
  opened: boolean
  surface: Surface
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

/**
 * Patches a standard material so its colour comes from the part's own local
 * coordinates: a diagonal hatch (the part's colour striped with the shared
 * colour), or a generic plywood grain tinted toward the part's colour.
 */
function useSurface(part: Part, surface: Surface, radius: number) {
  return React.useMemo(() => {
    const unique = new Color(PART_COLORS[part.type])
    const universal = new Color(UNIVERSAL_COLOR)
    const grainLight = new Color(GRAIN_LIGHT)
    const grainDark = new Color(GRAIN_DARK)
    // Grain runs along the part's length: the longest axis of a board, local x of a plate, y of a dowel.
    const axis =
      part.shape === "cylinder"
        ? new Vector3(0, 1, 0)
        : part.shape === "polygon"
          ? new Vector3(1, 0, 0)
          : part.extents[0] >= part.extents[1] && part.extents[0] >= part.extents[2]
            ? new Vector3(1, 0, 0)
            : part.extents[1] >= part.extents[2]
              ? new Vector3(0, 1, 0)
              : new Vector3(0, 0, 1)
    const period = Math.max(radius * 0.06, 6)
    const freq = (Math.PI * 2) / Math.max(radius * 0.03, 3)

    const onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uUnique = { value: unique }
      shader.uniforms.uUniversal = { value: universal }
      shader.uniforms.uGrainLight = { value: grainLight }
      shader.uniforms.uGrainDark = { value: grainDark }
      shader.uniforms.uAxis = { value: axis }
      shader.uniforms.uPeriod = { value: period }
      shader.uniforms.uFreq = { value: freq }
      shader.uniforms.uMode = { value: surface === "grain" ? 1 : surface === "solid" ? 2 : 0 }
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;")
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vObj;
uniform vec3 uUnique;
uniform vec3 uUniversal;
uniform vec3 uGrainLight;
uniform vec3 uGrainDark;
uniform vec3 uAxis;
uniform float uPeriod;
uniform float uFreq;
uniform float uMode;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
if (uMode > 1.5) {
  diffuseColor.rgb = uUnique;
} else if (uMode < 0.5) {
  // Anti-aliased stripes: a triangle wave smoothed by how fast it changes on screen,
  // so they blur to an even mix instead of moiré when seen at a shallow angle.
  float t = (vObj.x + vObj.y + vObj.z) / uPeriod;
  float tri = abs(fract(t) * 2.0 - 1.0);
  float w = fwidth(t) * 2.0;
  // A thin shared-colour pinstripe on the part's own colour, so the colour still leads.
  float band = smoothstep(0.9 - w, 0.9 + w, tri);
  diffuseColor.rgb = mix(uUnique, uUniversal, band * 0.5);
} else {
  float along = dot(vObj, uAxis);
  vec3 across = vObj - along * uAxis;
  float wave = sin(dot(across, vec3(0.7, 0.3, 1.1)) * uFreq * 0.3 + along * uFreq * 0.05);
  float coarse = sin(dot(across, vec3(1.0, 1.7, 2.3)) * uFreq + 2.5 * wave);
  float fine = sin(dot(across, vec3(2.1, 1.3, 0.9)) * uFreq * 3.1 + 1.5 * sin(along * uFreq * 0.05));
  float g = clamp(0.5 + 0.35 * coarse + 0.15 * fine, 0.0, 1.0);
  vec3 wood = mix(uGrainDark, uGrainLight, g);
  diffuseColor.rgb = mix(wood, uUnique, 0.32);
}`,
        )
    }
    return { onBeforeCompile, key: `${surface}` }
  }, [part, surface, radius])
}

function PartMesh({
  part,
  offset,
  progress,
  edgeColor,
  hingeLift,
  surface,
  radius,
  open,
  openT,
}: {
  part: Part
  offset: Vec3
  progress: React.RefObject<number>
  /** How to swing this part open about its hinge, if it opens. */
  open?: OpenSpec
  openT: React.RefObject<number>
  edgeColor: string
  hingeLift: Vec3
  surface: Surface
  radius: number
}) {
  const material = useSurface(part, surface, radius)
  const group = React.useRef<Group>(null)
  const pivotGroup = React.useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  // Everything inside the pivot group is positioned relative to the hinge line (or the origin).
  const pivot: Vec3 = open ? open.pivot : [0, 0, 0]
  const axis = React.useMemo(() => (open ? new Vector3(...open.axis) : null), [open])

  // Position follows the shared timeline every frame, staged per part type
  // (cheap, and it also places the part correctly on its first frame).
  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = partProgress(progress.current, part.type)
    g.position.set(offset[0] * p, offset[1] * p, offset[2] * p)
    // Swing about the hinge line while the rest of the box stays put.
    const pg = pivotGroup.current
    if (pg && open && axis) {
      pg.quaternion.setFromAxisAngle(axis, open.angle * openProgress(openT.current, open.rank, open.leaves))
    }
  })
  React.useEffect(() => invalidate(), [offset, invalidate])

  const plate = React.useMemo(() => (part.shape === "polygon" ? plateGeometry(part) : null), [part])
  React.useEffect(() => () => plate?.dispose(), [plate])

  const hinge = part.hinge
  return (
    <group ref={group}>
      <group ref={pivotGroup} position={pivot}>
      <mesh position={[part.center[0] - pivot[0], part.center[1] - pivot[1], part.center[2] - pivot[2]]} rotation={part.shape === "polygon" ? part.rotation : undefined}>
        {part.shape === "cylinder" ? (
          <cylinderGeometry args={[part.width / 2, part.width / 2, part.length, 40]} />
        ) : plate ? (
          <primitive object={plate} attach="geometry" />
        ) : (
          <boxGeometry args={part.extents} />
        )}
        <meshStandardMaterial
          key={material.key}
          color={PART_COLORS[part.type]}
          roughness={0.75}
          metalness={0}
          onBeforeCompile={material.onBeforeCompile}
          customProgramCacheKey={() => material.key}
        />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      {hinge ? (
        <Line
          points={[
            [
              hinge.from[0] - pivot[0] + hingeLift[0],
              hinge.from[1] - pivot[1] + hingeLift[1],
              hinge.from[2] - pivot[2] + hingeLift[2],
            ],
            [
              hinge.to[0] - pivot[0] + hingeLift[0],
              hinge.to[1] - pivot[1] + hingeLift[1],
              hinge.to[2] - pivot[2] + hingeLift[2],
            ],
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
    </group>
  )
}

function Scene({ result, lidPosition, exploded, resetKey, dark, surface, opened }: SceneProps) {
  const progress = React.useRef(0)
  const openT = React.useRef(0)
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

  // The same kind of timeline for opening the lid or door.
  useFrame((_, delta) => {
    const target = opened ? 1 : 0
    const t = openT.current
    if (t === target) return
    const step = delta / OPEN_SECONDS
    openT.current = target > t ? Math.min(target, t + step) : Math.max(target, t - step)
    invalidate()
  })

  const specs = React.useMemo(() => openSpecs(result.parts, lidPosition), [result.parts, lidPosition])
  // An open lid or door swings out beyond the box, so leave room for it.
  const openExtra = opened
    ? Math.max(0, ...result.parts.filter((p) => specs.has(p.id)).map((p) => Math.max(p.length, p.width))) * 0.55
    : 0

  const radius = viewRadius(result.bounds, (exploded ? distance : 0) + openExtra)
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
          surface={surface}
          radius={radius}
          open={specs.get(part.id)}
          openT={openT}
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
