"use client"

import * as React from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Edges, OrbitControls } from "@react-three/drei"
import { Color, ExtrudeGeometry, Quaternion, Shape, Vector2, Vector3, type BufferGeometry, type Group, type WebGLProgramParametersWithUniforms } from "three"

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
  plyCount,
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

/** Same program for every part and every look: colours and mode are uniforms, so nothing recompiles. */
const SURFACE_PROGRAM_KEY = () => "plyhead-surface"

/**
 * Patches a standard material so its colour comes from the part's own local
 * coordinates: a diagonal hatch (the part's colour with a thin shared pinstripe),
 * a generic plywood grain tinted toward the part's colour, or plain solid colour.
 *
 * Everything that can change (the look, the stripe scale, the part's colour and
 * grain direction) lives in uniforms that are updated in place, so switching
 * look or resizing the box never compiles a new shader.
 */
class SurfaceUniforms {
  values = {
    uUnique: { value: new Color() },
    uUniversal: { value: new Color(UNIVERSAL_COLOR) },
    uGrainLight: { value: new Color(GRAIN_LIGHT) },
    uGrainDark: { value: new Color(GRAIN_DARK) },
    uAxis: { value: new Vector3(1, 0, 0) },
    uPeriod: { value: 1 },
    uFreq: { value: 1 },
    uMode: { value: 0 },
    uThickAxis: { value: new Vector3(0, 1, 0) },
    uThick: { value: 18 },
    uPlies: { value: 9 },
    uSeed: { value: 0 },
    uRound: { value: 0 },
  }

  update(part: Part, surface: Surface, radius: number) {
    const v = this.values
    v.uUnique.value.set(PART_COLORS[part.type])
    // Grain runs along the part's length: the longest axis of a board, local x of a plate, y of a dowel.
    const axis =
      part.shape === "cylinder"
        ? [0, 1, 0]
        : part.shape === "polygon"
          ? [1, 0, 0]
          : part.extents[0] >= part.extents[1] && part.extents[0] >= part.extents[2]
            ? [1, 0, 0]
            : part.extents[1] >= part.extents[2]
              ? [0, 1, 0]
              : [0, 0, 1]
    v.uAxis.value.set(axis[0], axis[1], axis[2])
    v.uPeriod.value = Math.max(radius * 0.06, 6)
    v.uFreq.value = (Math.PI * 2) / Math.max(radius * 0.03, 3)
    v.uMode.value = surface === "grain" ? 1 : surface === "solid" ? 2 : 0

    // Plywood: the thickness axis is the thinnest one (a plate's geometry has it along y), and the
    // edges show `plies` stacked layers. Each part gets its own grain pattern from its id.
    const thin =
      part.shape === "polygon" || part.shape === "cylinder"
        ? [0, 1, 0]
        : part.extents[0] <= part.extents[1] && part.extents[0] <= part.extents[2]
          ? [1, 0, 0]
          : part.extents[1] <= part.extents[2]
            ? [0, 1, 0]
            : [0, 0, 1]
    v.uThickAxis.value.set(thin[0], thin[1], thin[2])
    v.uThick.value = part.thickness
    v.uPlies.value = plyCount(part.thickness)
    let h = 0
    for (let i = 0; i < part.id.length; i++) h = (h * 31 + part.id.charCodeAt(i)) % 1009
    v.uSeed.value = h / 1009
    v.uRound.value = part.shape === "cylinder" ? 1 : 0
  }
}

function useSurface(part: Part, surface: Surface, radius: number) {
  const invalidate = useThree((s) => s.invalidate)
  const [uniforms] = React.useState(() => new SurfaceUniforms())

  React.useEffect(() => {
    uniforms.update(part, surface, radius)
    invalidate()
  }, [uniforms, part, surface, radius, invalidate])

  const onBeforeCompile = React.useCallback(
    (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms.values)
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;\nvObjN = normal;")
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vObj;
varying vec3 vObjN;
uniform vec3 uUnique;
uniform vec3 uUniversal;
uniform vec3 uGrainLight;
uniform vec3 uGrainDark;
uniform vec3 uAxis;
uniform vec3 uThickAxis;
uniform float uPeriod;
uniform float uFreq;
uniform float uMode;
uniform float uThick;
uniform float uPlies;
uniform float uSeed;
uniform float uRound;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Face of a veneer: growth rings that wander and form arches, fine streaks along the grain,
// and tiny pores. u runs along the grain, v across it (both in mm). px is mm per screen pixel;
// fine detail fades to an even tone when zoomed out so it doesn't shimmer.
vec3 woodFace(float u, float v, float px) {
  vec2 o = vec2(uSeed * 37.1, uSeed * 91.7);
  float warp = fbm(vec2(u * 0.006, v * 0.05) + o);
  float d = length(vec2((u + o.x * 13.0) * 0.12, v + o.y * 4.0)) + warp * 2.6;
  float ring = abs(fract(d / 3.4) - 0.5) * 2.0;
  float late = smoothstep(0.5, 0.95, ring);
  float streak = fbm(vec2(u * 0.05, v * 3.0) + o * 2.0);
  float pores = smoothstep(0.8, 0.95, vnoise(vec2(u * 0.6, v * 7.0) + o));
  float detail = 1.0 - clamp(px / 1.8, 0.0, 1.0);
  float t = clamp(late * 0.5 + streak * 0.35 + pores * 0.18 * detail, 0.0, 1.0);
  vec3 avg = mix(uGrainLight, uGrainDark, 0.42);
  return mix(avg, mix(uGrainLight, uGrainDark, t), 0.45 + 0.55 * detail);
}

// Edge of a sheet: the plies show as stacked layers with thin glue lines. Plies alternate
// between running along the edge (long grain, fine streaks) and across it (end grain, speckled
// and a little darker). h is the distance through the thickness (0 to uThick), u along the edge.
vec3 woodEdge(float h, float u, float px) {
  float x = clamp(h / uThick, 0.0, 0.9999) * uPlies;
  float p = floor(x);
  float f = fract(x);
  bool across = mod(p, 2.0) > 0.5;
  float tone = 0.8 + 0.2 * hash21(vec2(p, uSeed * 17.0));
  vec3 base = across ? mix(uGrainLight, uGrainDark, 0.62) : mix(uGrainLight, uGrainDark, 0.04);
  float grain = across ? fbm(vec2(u * 0.9, h * 5.0) + uSeed) : fbm(vec2(u * 0.05, h * 7.0) + uSeed);
  base = mix(base, uGrainDark, grain * (across ? 0.45 : 0.3)) * tone;
  // Glue lines are drawn a little wider than life so the layers read at normal viewing distance.
  float glue = smoothstep(0.0, 0.16, f) * (1.0 - smoothstep(0.84, 1.0, f));
  float visible = clamp(1.0 - (px - 1.2) / 2.0, 0.55, 1.0);
  return mix(base, uGrainDark * 0.38, (1.0 - glue) * visible);
}

// End grain of a dowel: concentric growth rings.
vec3 woodRound(vec3 p, float px) {
  float r = length(p.xz);
  float wob = fbm(vec2(atan(p.z, p.x) * 2.0, r * 0.2) + uSeed * 13.0);
  float ring = abs(fract((r + wob * 2.0) / 2.2) - 0.5) * 2.0;
  float detail = 1.0 - clamp(px / 1.5, 0.0, 1.0);
  float t = smoothstep(0.45, 0.95, ring) * (0.35 + 0.5 * detail);
  return mix(uGrainLight, uGrainDark, clamp(t + 0.12, 0.0, 1.0));
}`,
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
  float px = length(fwidth(vObj));
  vec3 wood;
  if (uRound > 0.5) {
    if (abs(vObjN.y) > 0.5) {
      wood = woodRound(vObj, px);
    } else {
      wood = woodFace(vObj.y, vObj.x + vObj.z, px);
    }
  } else {
    vec3 across = normalize(cross(uAxis, uThickAxis));
    if (abs(dot(vObjN, uThickAxis)) > 0.5) {
      wood = woodFace(dot(vObj, uAxis), dot(vObj, across), px);
    } else {
      wood = woodEdge(dot(vObj, uThickAxis) + uThick * 0.5, dot(vObj, uAxis) + dot(vObj, across), px);
    }
  }
  diffuseColor.rgb = mix(wood, uUnique, 0.12);
}`,
        )
    },
    [uniforms],
  )
  return { onBeforeCompile }
}

/**
 * The hinge line as a thin bar. (A fat-line component used to live here, but it
 * rebuilt and recompiled its shader on every toggle, which made the first few
 * animations stutter.) Plain mesh + basic material compile once.
 */
function HingeBar({ from, to, thickness }: { from: Vec3; to: Vec3; thickness: number }) {
  const { mid, length, quaternion } = React.useMemo(() => {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    return {
      mid: a.clone().add(b).multiplyScalar(0.5).toArray() as Vec3,
      length: len,
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
    }
  }, [from, to])
  return (
    <mesh position={mid} quaternion={quaternion} renderOrder={10}>
      <cylinderGeometry args={[thickness, thickness, length, 12]} />
      {/* Drawn through the lid so you can always see which edge hinges. */}
      <meshBasicMaterial color={HINGE_COLOR} depthTest={false} transparent opacity={0.9} />
    </mesh>
  )
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
  // Relative to the pivot, nudged inside the lid (stable arrays so the bar isn't rebuilt on every render).
  const hingeFrom = React.useMemo<Vec3>(
    () =>
      hinge
        ? [
            hinge.from[0] - pivot[0] + hingeLift[0],
            hinge.from[1] - pivot[1] + hingeLift[1],
            hinge.from[2] - pivot[2] + hingeLift[2],
          ]
        : [0, 0, 0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hinge, pivot[0], pivot[1], pivot[2], hingeLift[0], hingeLift[1], hingeLift[2]],
  )
  const hingeTo = React.useMemo<Vec3>(
    () =>
      hinge
        ? [
            hinge.to[0] - pivot[0] + hingeLift[0],
            hinge.to[1] - pivot[1] + hingeLift[1],
            hinge.to[2] - pivot[2] + hingeLift[2],
          ]
        : [0, 0, 0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hinge, pivot[0], pivot[1], pivot[2], hingeLift[0], hingeLift[1], hingeLift[2]],
  )
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
          color={PART_COLORS[part.type]}
          roughness={0.75}
          metalness={0}
          onBeforeCompile={material.onBeforeCompile}
          customProgramCacheKey={SURFACE_PROGRAM_KEY}
        />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      {hinge ? <HingeBar from={hingeFrom} to={hingeTo} thickness={Math.max(radius * 0.004, 1)} /> : null}
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
