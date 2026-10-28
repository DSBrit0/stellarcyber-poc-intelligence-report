import type { SceneState, SceneTarget, StackChapter, StageId } from '@poc-intel/shared'
import { Edges, Html, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import gsap from 'gsap'
import type { ChromaticAberrationEffect } from 'postprocessing'
import type { Line2, LineGeometry } from 'three-stdlib'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { Chamber, ringStops, tubeView } from './Chamber'
import type { AudienceWords } from '../content/types'
import { SATELLITE_STAGES, SLAB, stackLayout } from './layout'

/** Brand colours (Brand Guidelines 2026 v4; Cube Blue from the Multi-Layer AI v4 brief). */
const C = {
  midnight: '#0A1823',
  ground: '#04060D',
  cube: '#2059E0',
  sky: '#3044E0',
  skyMid: '#3295F8',
  skyLight: '#41C5F9',
  purple: '#9320E0',
  solar: '#FF9B1D',
  burnt: '#F05B2A',
  silver: '#FAFAF4',
}

/**
 * Each layer's colour, as the Multi-Layer AI v4 data sheet draws the Stack: the Data Engine in red,
 * Open XDR in Solar Orange, the Autonomous SOC in blue, inside an AI Purple housing. `edge` lights
 * the plate outlines and the label leaders. Each layer's mission (the data sheet's name for what it delivers) comes in `missions`.
 */
const LAYER: Record<StackChapter, { base: string; edge: string }> = {
  data_engine: { base: '#D8261C', edge: '#FF7A4D' },
  open_xdr: { base: C.solar, edge: '#FFC870' },
  agentic_soc: { base: C.cube, edge: C.skyLight },
}

/** A layer left out of the selection: light grey, so the selected one reads at once. */
const MUTED = '#9aa3ad'

/** What powers each layer, as the Multi-Layer AI v4 brief names it. */
const ENABLEMENT: Record<StackChapter, string[]> = {
  data_engine: ['Machine Learning'],
  open_xdr: ['Machine Learning', 'Graph ML'],
  agentic_soc: ['Agentic AI', 'GenAI LLM', 'MCP'],
}

/** AI Purple only for machine learning; orange for what threatens; blues for the rest. */
const SATELLITE_COLOR: Partial<Record<StageId, string>> = {
  threat_intel: C.solar,
  ndr: C.skyLight,
  sandbox: C.burnt,
  fim: C.skyMid,
  itdr_ueba: C.purple,
}

/** Someone in the session other than the Presenter, as their name floats above the Stack. */
export interface AudienceMember {
  id: string
  name: string
  /** Looking at the session; away (page hidden, window out of focus, pointer off the page); or gone (no sign for 30 s). */
  state: 'here' | 'away' | 'left'
  mine: boolean
  /** "SE" for a Stellar Cyber runner watching; none for a Customer User. */
  badge?: string
}

export interface StackSceneProps {
  stages: StageId[]
  current: StageId
  settled: ReadonlySet<StageId>
  /** The approved Data Sources: they take the place of the brand's source families at the base. */
  sources: string[]
  chapterTitles: Record<StackChapter, string>
  /** Each layer's mission, in the viewer's language. */
  missions: Record<StackChapter, string>
  /** The brand's six source families at the Stack's base, until the Customer's own Data Sources are approved. */
  defaultSources: string[]
  stageTitles: Record<StageId, string>
  reducedMotion: boolean
  /** Fraction of the width the HUD covers on the right: the Stack is framed in what is left. */
  shift: number
  /** Fraction of the height to push the Stack down, below a panel open at the top left. */
  shiftDown: number
  /** A little farther while the wide Briefing terminal takes the right of the screen. */
  wide: boolean
  /** The interaction model and the object the Presenter entered (plan, Q38–Q39). */
  scene: SceneState
  /** In the pipeline: the Stages the traced record goes through, in order, and how far it has got. */
  traceStages: StageId[]
  traceIndex: number
  /** Whether this viewer may enter objects: the Presenter, or anyone in a replay. */
  canInteract: boolean
  onEnter: (target: SceneTarget) => void
  /** The layer under the Presenter's pointer, for everyone who follows the Presenter. */
  pointedLayer: StageId | null
  /** The Presenter's own hovering, reported so the others see it. */
  onLayerHover: (layer: StageId | null) => void
  /** The layer selected by its name: its plates stand out, the rest turn light grey. */
  selectedChapter: StackChapter | null
  /** Clicking a layer's name selects it; clicking it again lets go. */
  onChapter: (chapter: StackChapter | null) => void
  /** Everyone in the session but the Presenter: their names float above the purple top, tied to it. */
  audience: AudienceMember[]
  audienceWords: AudienceWords
}

/**
 * The Multi-Layer AI™ Stack as the v4 data sheet draws it: one coloured glass plate per Stage, the
 * three layers in their own colours (red, orange, blue) inside an AI Purple housing, each plate's
 * name floating beside it on a soft leader line. The Presenter's Stage lifts and lights; data rises
 * from the sources at the base up to it.
 */
export default function StackScene(props: StackSceneProps) {
  const layout = useMemo(() => stackLayout(props.stages), [props.stages])
  const focus = layout.slabs.find((s) => s.id === props.current)?.y ?? 0
  const bottom = layout.slabs[0]?.y ?? 0
  const top = layout.slabs[layout.slabs.length - 1]?.y ?? 0
  const ca = useRef<ChromaticAberrationEffect>(null)
  const offset = useMemo(() => new THREE.Vector2(0.0003, 0.00015), [])
  const sources = props.sources.length > 0 ? props.sources.slice(0, 12) : props.defaultSources
  const target = props.scene.target
  // Entering an object, either way, takes everyone into the tunnel: one ring in Data ingestion, one per engine in the Pipeline.
  const tracing = props.scene.model === 'trace' && target != null
  const tubeStages: (StageId | null)[] | null =
    target == null ? null : tracing && props.traceStages.length > 0 ? props.traceStages : [target.kind === 'stage' ? (target.key as StageId) : null]
  const traced = tracing && tubeStages ? Math.min(props.traceIndex, tubeStages.length - 1) : null
  const tube = tubeStages ? tubeView(ringStops(tubeStages.length)[traced ?? 0]!) : null
  // A click, not the end of a drag: R3F reports how far the pointer travelled.
  const enter = (t: SceneTarget) => (e: ThreeEvent<MouseEvent>) => {
    if (!props.canInteract || e.delta > 4) return
    e.stopPropagation()
    props.onEnter(t)
  }
  const hover = (on: boolean) => () => {
    if (props.canInteract) document.body.style.cursor = on ? 'pointer' : ''
  }
  // The layer under the pointer, on its plate or its floating label, lifts and lights. Whoever leads the
  // view sees their own pointer; everyone else sees the Presenter's.
  const [own, setOwn] = useState<StageId | null>(null)
  const hovered = props.canInteract ? own : props.pointedLayer
  const hoverLayer = (id: StageId) => (on: boolean) => () => {
    if (props.canInteract) {
      const next = on ? id : own === id ? null : own
      setOwn(next)
      props.onLayerHover(next)
    }
    hover(on)()
  }
  useEffect(() => () => void (document.body.style.cursor = ''), [])
  const [recenter, setRecenter] = useState(0)
  return (
    <Canvas
      // A double click on empty space brings the camera back to the Stack.
      onDoubleClick={() => setRecenter((n) => n + 1)}
      dpr={[1, 2]} camera={{ fov: 30, position: [16, 9, 16], near: 0.1, far: 300 }} gl={{ antialias: true, powerPreference: 'high-performance' }} style={{ position: 'absolute', inset: 0 }}>
      {/* Far enough that a zoomed-out Stack keeps its colours. */}
      <fog attach="fog" args={[C.ground, 50, 120]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 14, 8]} intensity={0.8} color={C.silver} />
      <Framing shift={props.shift} shiftDown={props.shiftDown} />
      <Backdrop />
      <Shell bottom={bottom - 0.5} top={top + 0.5} />
      {tube ? null : <Audience people={props.audience} words={props.audienceWords} capTop={top + 0.5 + 0.55 + 0.21} />}
      {layout.slabs.map((s) => {
        const state = s.id === props.current ? 'lit' : props.settled.has(s.id) ? 'done' : 'idle'
        const tone = props.selectedChapter == null ? null : s.chapter === props.selectedChapter ? 'focus' : 'muted'
        return (
          <group key={s.id}>
            <Plate
              y={s.y}
              layer={LAYER[s.chapter]}
              state={state}
              hovered={hovered === s.id}
              tone={tone}
              reducedMotion={props.reducedMotion}
              onClick={enter({ kind: 'stage', key: s.id })}
              onHover={hoverLayer(s.id)}
            />
            <LayerLabel
              index={layout.slabs.indexOf(s)}
              y={s.y}
              label={props.stageTitles[s.id]}
              layer={LAYER[s.chapter]}
              state={state}
              hovered={hovered === s.id}
              tone={tone}
              canInteract={props.canInteract}
              reducedMotion={props.reducedMotion}
              onEnter={() => props.canInteract && props.onEnter({ kind: 'stage', key: s.id })}
              onHover={hoverLayer(s.id)}
            />
          </group>
        )
      })}
      {chapterLabelYs(layout.chapters).map(({ c, y }) => {
        const selected = props.selectedChapter === c.chapter
        // With a layer selected, its name is the bright one; otherwise the name of the Presenter's layer.
        const active = props.selectedChapter ? selected : c.from <= focus + 0.01 && focus <= c.to + 0.01
        const layer = LAYER[c.chapter]
        return (
          <Html key={c.chapter} position={[-SLAB.size / 2 - 0.5, y, SLAB.size / 2 + 0.5]} zIndexRange={[5, 0]} className="pointer-events-none">
            <button
              type="button"
              tabIndex={-1}
              aria-pressed={selected}
              disabled={!props.canInteract}
              onClick={() => props.onChapter(selected ? null : c.chapter)}
              onPointerEnter={hover(true)}
              onPointerLeave={hover(false)}
              className={`block -translate-x-full -translate-y-1/2 rounded-r border-r-2 pr-3 text-right transition-[opacity,filter] duration-500 ${
                props.canInteract ? 'pointer-events-auto cursor-pointer' : 'cursor-default'
              } ${active ? 'opacity-100' : props.selectedChapter ? 'opacity-40 grayscale' : 'opacity-55'}`}
              style={{ borderColor: props.selectedChapter && !selected ? MUTED : layer.base, boxShadow: selected ? `8px 0 18px -10px ${layer.edge}` : undefined }}
            >
              <p className="text-sm font-semibold whitespace-nowrap text-sc-silver">{props.chapterTitles[c.chapter]}</p>
              <p className="text-xs font-medium whitespace-nowrap" style={{ color: layer.edge }}>
                {props.missions[c.chapter]}
              </p>
              <p className="mt-1 flex justify-end gap-1">
                {ENABLEMENT[c.chapter].map((e) => (
                  <span key={e} className="rounded border border-white/20 px-1.5 text-[10px] whitespace-nowrap text-sc-silver/70">
                    {e}
                  </span>
                ))}
              </p>
            </button>
          </Html>
        )
      })}
      {layout.slabs
        .filter((s) => SATELLITE_STAGES.includes(s.id))
        .map((s, i) => (
          <Satellite key={s.id} y={s.y} phase={i * 1.3} color={SATELLITE_COLOR[s.id] ?? C.skyLight} lit={s.id === props.current} label={props.stageTitles[s.id]} reducedMotion={props.reducedMotion} />
        ))}
      <SourceTiles
        names={sources}
        y={bottom - 2.6}
        lit={props.current === 'data_sources' || props.current === 'collection'}
        faint={props.sources.length === 0}
        selected={target?.kind === 'source' ? target.key : null}
        onPick={(name) => enter({ kind: 'source', key: name })}
        onHover={hover}
      />
      <DataStream from={bottom - 2.5} to={focus} reducedMotion={props.reducedMotion} />
      {tubeStages ? <Chamber stages={tubeStages} traced={traced} reducedMotion={props.reducedMotion} /> : null}
      {/* Aim mostly at the Stack's middle, a little towards the lit plate: the whole Stack stays in frame. */}
      <CameraRig
        focusY={(focus + 3 * ((top + bottom) / 2)) / 4}
        distance={props.wide ? 45 : 41}
        tube={tube}
        recenter={recenter}
        reducedMotion={props.reducedMotion}
        aberration={ca}
      />
      {/* Left drag turns the Stack; right drag (or Shift + drag) moves it, never farther than a Stack's width; wheel zooms. */}
      <OrbitControls
        makeDefault
        enabled={!tube}
        enablePan
        screenSpacePanning
        enableDamping
        minDistance={14}
        maxDistance={56}
        minPolarAngle={0.55}
        maxPolarAngle={1.45}
        onChange={(e) => {
          // Pulls camera and target back together, so a pan past the limit stops instead of tilting the view.
          // Not in the tunnel: it lies far from the Stack, and the limit would drag the camera back out of it.
          const c = e?.target as unknown as { target: THREE.Vector3; object: THREE.Camera } | undefined
          if (!c || tube) return
          const t = c.target
          const back = new THREE.Vector3(THREE.MathUtils.clamp(t.x, -PAN, PAN), THREE.MathUtils.clamp(t.y, bottom - PAN, top + PAN), THREE.MathUtils.clamp(t.z, -PAN, PAN)).sub(t)
          if (back.lengthSq() === 0) return
          t.add(back)
          c.object.position.add(back)
        }}
      />
      {/* MSAA keeps the plate edges and lines clean; bloom only catches what is truly bright. */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.82} luminanceSmoothing={0.15} />
        <ChromaticAberration ref={ca} offset={offset} radialModulation={false} modulationOffset={0} />
        <Vignette darkness={0.6} offset={0.28} />
      </EffectComposer>
    </Canvas>
  )
}

/** Each layer's name sits level with its plates, pushed apart when a short layer would make two overlap. */
function chapterLabelYs(chapters: { chapter: StackChapter; from: number; to: number }[]) {
  const MIN = 1.9
  const out = chapters.map((c) => ({ c, y: (c.from + c.to) / 2 }))
  for (let i = 1; i < out.length; i++) out[i]!.y = Math.max(out[i]!.y, out[i - 1]!.y + MIN)
  return out
}

/** How far the Presenter can move the Stack aside by panning, in scene units. */
const PAN = SLAB.size

/** Shifts the projection so the Stack sits in the space the HUD leaves free. */
function Framing({ shift, shiftDown }: { shift: number; shiftDown: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  // Eased, so opening a panel slides the Stack aside instead of jumping.
  const now = useRef({ x: shift, y: shiftDown })
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 4)
    now.current.x += (shift - now.current.x) * k
    now.current.y += (shiftDown - now.current.y) * k
    camera.setViewOffset(size.width, size.height, size.width * now.current.x, -size.height * now.current.y, size.width, size.height)
  })
  useEffect(() => () => camera.clearViewOffset(), [camera])
  return null
}

/** On every Stage change (or a double click) the camera glides back to the Stack, with a brief chromatic aberration as it accelerates. */
function CameraRig({
  focusY,
  distance,
  tube,
  recenter,
  reducedMotion,
  aberration,
}: {
  focusY: number
  distance: number
  /** Inside the tunnel: where the camera sits and what it looks at. */
  tube: { eye: { x: number; y: number; z: number }; look: { x: number; y: number; z: number } } | null
  /** Bumped by a double click: the camera glides back even when nothing else changed. */
  recenter: number
  reducedMotion: boolean
  aberration: RefObject<ChromaticAberrationEffect | null>
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => {
    if (!controls) return
    const dir = new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(distance)
    // Inside the tunnel the camera sits just before the ring at work, looking down towards it.
    const target = tube ? tube.look : { x: 0, y: focusY, z: 0 }
    const pos = tube ? tube.eye : { x: dir.x, y: focusY + dir.y, z: dir.z }
    if (reducedMotion) {
      camera.position.set(pos.x, pos.y, pos.z)
      controls.target.set(target.x, target.y, target.z)
      controls.update()
      return
    }
    const tl = gsap.timeline({ defaults: { duration: 1.6, ease: 'power3.inOut' }, onUpdate: () => controls.update() })
    tl.to(camera.position, pos, 0).to(controls.target, target, 0)
    const offset = aberration.current?.offset
    if (offset) tl.fromTo(offset, { x: 0.005, y: 0.0025 }, { x: 0.0003, y: 0.00015, duration: 1.4, ease: 'power2.out' }, 0)
    return () => {
      tl.kill()
    }
  }, [focusY, distance, tube?.eye.x, tube?.eye.y, tube?.eye.z, recenter, controls, camera, reducedMotion, aberration])
  return null
}

/**
 * The space around the Stack (Multi-Layer AI v4 cover): an opaque sky, near-black, with a soft
 * Cube Blue glow behind the Stack and a hint of AI Purple below it. Opaque and dim on purpose: the
 * colour is atmosphere, never a veil over the plates.
 */
function Backdrop() {
  // Radius 100 with the camera at most 56 from the centre: the far side stays within the camera's far plane (300).
  // Past it the sky was clipped and the gap showed as a greenish polygon behind the Stack.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uGround: { value: new THREE.Color(C.ground) }, uCube: { value: new THREE.Color(C.cube) }, uPurple: { value: new THREE.Color(C.purple) } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform vec3 uGround; uniform vec3 uCube; uniform vec3 uPurple; varying vec3 vDir;
          void main(){
            // Glow towards the far side of the Stack from the default camera, fading upwards and downwards.
            float behind = pow(max(dot(vDir, normalize(vec3(-1.0, 0.0, -1.0))), 0.0), 6.0);
            float low = smoothstep(0.1, -0.6, vDir.y);
            vec3 c = uGround + uCube * 0.11 * behind + uPurple * 0.04 * low * behind;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  )
  return (
    <mesh material={material}>
      <sphereGeometry args={[100, 48, 32]} />
    </mesh>
  )
}

/**
 * The Stack's AI Purple housing, as in the data sheet: translucent walls around the layers, a faint
 * outline, and the "Multi-Layer AI™" cap on top.
 */
function Shell({ bottom, top }: { bottom: number; top: number }) {
  const w = SLAB.size + 0.9
  const h = top - bottom
  const box = useMemo(() => new THREE.BoxGeometry(w, h, w), [w, h])
  return (
    <group>
      <mesh geometry={box} position={[0, (top + bottom) / 2, 0]} renderOrder={-1}>
        <meshBasicMaterial color={C.purple} transparent opacity={0.05} depthWrite={false} side={THREE.BackSide} />
        <Edges color={C.purple} transparent opacity={0.55} worldUnits lineWidth={EDGE} />
      </mesh>
      <mesh position={[0, top + 0.55, 0]}>
        <boxGeometry args={[w * 0.62, 0.42, w * 0.62]} />
        <meshStandardMaterial color={C.purple} emissive={C.purple} emissiveIntensity={0.55} transparent opacity={0.85} roughness={0.4} depthWrite={false} />
        <Edges color="#C77DFF" transparent opacity={0.8} worldUnits lineWidth={EDGE} />
        <Html position={[0, 0.02, w * 0.31]} center zIndexRange={[5, 0]} className="pointer-events-none">
          <p className="font-semibold whitespace-nowrap text-sc-silver drop-shadow">Multi-Layer AI™</p>
        </Html>
      </mesh>
    </group>
  )
}

/** Names that fit above the Stack; the rest are counted in one more tag. */
const AUDIENCE_MAX = 10
const AUDIENCE_DOT: Record<AudienceMember['state'], string> = {
  here: 'bg-[#3FB950] shadow-[0_0_8px_#3FB950]',
  away: 'bg-[#F5A524] shadow-[0_0_8px_#F5A524]',
  left: 'bg-white/25',
}

/**
 * Who is watching: a floating name per person on an arc above the purple top, facing the camera, each
 * tied to the top by a soft purple leader, like the Stages' names. A name is dimmed with "away" while
 * that person is not looking at the session.
 */
function Audience({ people, words, capTop }: { people: AudienceMember[]; words: AudienceWords; capTop: number }) {
  const shown = people.slice(0, AUDIENCE_MAX)
  const extra = people.length - shown.length
  const tags = useMemo(() => {
    const n = shown.length + (extra > 0 ? 1 : 0)
    const half = (SLAB.size + 0.9) * 0.31
    // Centred on the default camera's side of the Stack, spread up to 80° each way.
    const spread = Math.min(1.4, 0.32 * (n - 1))
    return Array.from({ length: n }, (_, i) => {
      const a = Math.PI / 4 + (n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1))
      const r = 3.4 + (i % 2) * 0.6
      const tag = new THREE.Vector3(r * Math.cos(a), capTop + 1.3 + (i % 2) * 0.8, r * Math.sin(a))
      const from = new THREE.Vector3(half * Math.cos(a), capTop, half * Math.sin(a))
      const curve = new THREE.QuadraticBezierCurve3(from, new THREE.Vector3(tag.x * 0.75, capTop + 0.15, tag.z * 0.75), tag)
      return { tag, points: curve.getPoints(20) }
    })
  }, [shown.length, extra, capTop])
  return (
    <group>
      {shown.map((p, i) => {
        const t = tags[i]!
        const looking = p.state === 'here'
        return (
          <group key={p.id}>
            <Line points={t.points} color="#C77DFF" lineWidth={0.8} transparent opacity={looking ? 0.55 : 0.2} />
            <Html position={t.tag} center zIndexRange={[6, 0]} className="pointer-events-none">
              <span
                title={looking ? undefined : p.state === 'away' ? words.awayHint : words.leftHint}
                className={`pointer-events-auto flex items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-1.5 text-xs whitespace-nowrap backdrop-blur-md transition-all duration-500 ${
                  looking ? 'border-[#C77DFF]/50 bg-sc-midnight/80 text-sc-silver' : 'border-white/10 bg-sc-midnight/40 text-sc-silver/55'
                }`}
              >
                <span className={`size-2 shrink-0 rounded-full ${AUDIENCE_DOT[p.state]}`} aria-hidden />
                <span className="max-w-[10rem] truncate">{p.name}</span>
                {p.mine ? <span className="text-[10px] text-sc-silver/50">({words.you})</span> : null}
                {p.badge ? <span className="rounded bg-sc-sky/40 px-1 text-[10px] text-sc-silver">{p.badge}</span> : null}
                {looking ? null : <span className="text-[10px] font-semibold tracking-wide text-[#F5A524] uppercase">{words.away}</span>}
              </span>
            </Html>
          </group>
        )
      })}
      {extra > 0 ? (
        <group>
          <Line points={tags[shown.length]!.points} color="#C77DFF" lineWidth={0.8} transparent opacity={0.3} />
          <Html position={tags[shown.length]!.tag} center zIndexRange={[6, 0]} className="pointer-events-none">
            <span className="rounded-full border border-white/15 bg-sc-midnight/60 px-2 py-0.5 text-xs whitespace-nowrap text-sc-silver/75">
              {words.more.replace('{n}', String(extra))}
            </span>
          </Html>
        </group>
      ) : null}
    </group>
  )
}

/**
 * Outline width in scene units, not pixels: a pixel-wide outline stays as wide when the camera backs
 * away, until the outlines of fifteen plates cover the shrunken Stack and blend into one colour.
 */
const EDGE = 0.02

const plateBody = new THREE.BoxGeometry(SLAB.size, SLAB.thickness, SLAB.size)
const plateTop = new THREE.PlaneGeometry(SLAB.size * 1.08, SLAB.size * 1.08)

/** A plate's top: coloured glass, lighter in the middle and fading at the rim, as in the data sheet. */
function plateMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uHighlight: { value: new THREE.Color(C.silver) }, uOpacity: { value: 0.3 }, uLit: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uHighlight; uniform float uOpacity; uniform float uLit; varying vec2 vUv;
      void main(){
        vec2 d = abs(vUv - 0.5) * 2.0;
        float edge = max(d.x, d.y);
        float centre = 1.0 - smoothstep(0.0, 0.95, length(vUv - 0.5) * 1.6);
        vec3 c = mix(uColor, uHighlight, 0.18 + 0.32 * centre * (0.4 + 0.6 * uLit));
        float a = (0.75 + 0.25 * centre) * (1.0 - smoothstep(0.96, 1.0, edge));
        gl_FragColor = vec4(c, a * uOpacity);
      }`,
  })
}

type PlateState = 'lit' | 'done' | 'idle'
interface Layer {
  base: string
  edge: string
}

/** One Stage: a slab in its layer's colour, outlined; it lifts and lights when it is the Presenter's or under the pointer. */
function Plate({
  y,
  layer,
  state,
  hovered,
  tone,
  reducedMotion,
  onClick,
  onHover,
}: {
  y: number
  layer: Layer
  state: PlateState
  hovered: boolean
  /** Inside the selected layer ('focus') or out of it ('muted', light grey); null with no layer selected. */
  tone: 'focus' | 'muted' | null
  reducedMotion: boolean
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onHover: (on: boolean) => () => void
}) {
  const group = useRef<THREE.Group>(null)
  const top = useMemo(() => plateMaterial(layer.base), [layer.base])
  const body = useRef<THREE.MeshStandardMaterial>(null)
  const muted = tone === 'muted'
  // A selected layer stands out as a whole: every plate lifts and lights as if under the pointer.
  const raised = !muted && (hovered || tone === 'focus')
  const up = !muted && (state === 'lit' || raised)
  const colour = useMemo(() => new THREE.Color(muted ? MUTED : layer.base), [muted, layer.base])
  const goal = muted
    ? { y, opacity: 0.22, lit: 0, body: 0.26, glow: 0.04 }
    : {
        y: y + (state === 'lit' ? 0.22 : raised ? 0.14 : 0),
        opacity: state === 'lit' ? 0.9 : raised ? 0.8 : state === 'done' ? 0.6 : 0.42,
        lit: up ? 1 : 0,
        body: state === 'lit' ? 0.72 : raised ? 0.66 : state === 'done' ? 0.55 : 0.45,
        glow: state === 'lit' ? 0.85 : raised ? 0.65 : state === 'done' ? 0.35 : 0.18,
      }
  useFrame((_, dt) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6)
    if (group.current) group.current.position.y += (goal.y - group.current.position.y) * k
    const u = top.uniforms
    u.uOpacity!.value += (goal.opacity - u.uOpacity!.value) * k
    u.uLit!.value += (goal.lit - u.uLit!.value) * k
    ;(u.uColor!.value as THREE.Color).lerp(colour, k)
    if (body.current) {
      body.current.opacity += (goal.body - body.current.opacity) * k
      body.current.emissiveIntensity += (goal.glow - body.current.emissiveIntensity) * k
      body.current.color.lerp(colour, k)
      body.current.emissive.lerp(colour, k)
    }
  })
  return (
    <group ref={group} position={[0, y, 0]}>
      <mesh geometry={plateBody} onClick={onClick} onPointerOver={onHover(true)} onPointerOut={onHover(false)}>
        <meshStandardMaterial ref={body} color={layer.base} emissive={layer.base} emissiveIntensity={0.18} transparent opacity={0.3} roughness={0.35} metalness={0} depthWrite={false} />
        {/* The outline is what tells one layer from the next. */}
        <Edges color={muted ? MUTED : up ? C.silver : layer.edge} transparent opacity={muted ? 0.3 : up ? 0.95 : 0.5} worldUnits lineWidth={up ? EDGE * 1.8 : EDGE} />
      </mesh>
      <mesh geometry={plateTop} material={top} rotation={[-Math.PI / 2, 0, 0]} position={[0, SLAB.thickness / 2 + 0.002, 0]} />
    </group>
  )
}

/**
 * A Stage's name, floating in space off the Stack's right side, tied to its plate by a soft, thin
 * curve. Each name drifts gently in its own rhythm and the curve follows it. Hovering the name lights
 * the plate; clicking it enters the plate, as clicking the plate does.
 */
function LayerLabel({
  index,
  y,
  label,
  layer,
  state,
  hovered,
  tone,
  canInteract,
  reducedMotion,
  onEnter,
  onHover,
}: {
  index: number
  y: number
  label: string
  layer: Layer
  state: PlateState
  hovered: boolean
  tone: 'focus' | 'muted' | null
  canInteract: boolean
  reducedMotion: boolean
  onEnter: () => void
  onHover: (on: boolean) => () => void
}) {
  const h = SLAB.size / 2
  const muted = tone === 'muted'
  const up = !muted && (state === 'lit' || hovered || tone === 'focus')
  // Out in the space beside the Stack; every other name a little farther, so they read as scattered, not ruled.
  const out = 3.1 + (index % 2) * 0.5
  const line = useRef<Line2>(null)
  const curve = useMemo(() => new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), [])
  const initial = useMemo(() => leader(curve, h, y, out, y), [curve, h, y, out])
  const tag = useRef<THREE.Group>(null)
  // The name stays level with its plate's resting height: lifting it with a lit plate pushed it onto the next name.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const drift = reducedMotion ? 0 : Math.sin(t * 0.55 + index * 1.7) * 0.06
    const sway = reducedMotion ? 0 : Math.cos(t * 0.4 + index * 2.3) * 0.16
    const py = y
    const ex = h + out + sway
    const ez = -h - out - sway
    const ey = py + drift
    tag.current?.position.set(ex, ey, ez)
    if (line.current) (line.current.geometry as LineGeometry).setPositions(leader(curve, h, py, out, ey, sway))
  })
  return (
    <group>
      <Line
        ref={line}
        points={initial}
        color={muted ? MUTED : up ? C.silver : layer.edge}
        lineWidth={up ? 1.4 : 0.8}
        transparent
        opacity={muted ? 0.16 : up ? 0.8 : state === 'done' ? 0.38 : 0.24}
      />
      <group ref={tag} position={[h + out, y, -h - out]}>
        <Html zIndexRange={[6, 0]}>
          <button
            type="button"
            tabIndex={-1}
            onPointerEnter={onHover(true)}
            onPointerLeave={onHover(false)}
            onClick={onEnter}
            title={label}
            className={`flex -translate-y-1/2 items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-1.5 text-xs whitespace-nowrap backdrop-blur-md transition-all duration-300 ${
              up ? 'bg-sc-midnight/85 font-semibold text-sc-silver' : state === 'done' ? 'border-white/10 bg-sc-midnight/45 text-sc-silver/85' : 'border-white/[0.07] bg-sc-midnight/30 text-sc-silver/65'
            } ${muted ? 'opacity-40 grayscale' : ''} ${canInteract ? 'cursor-pointer' : 'cursor-default'}`}
            style={up ? { borderColor: layer.edge, boxShadow: `0 0 22px ${layer.base}55` } : undefined}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: layer.base, boxShadow: `0 0 ${up ? 10 : 5}px ${layer.edge}` }} />
            <span className="max-w-[12rem] truncate">{label}</span>
          </button>
        </Html>
      </group>
    </group>
  )
}

/**
 * The leader from a plate's corner to its floating name: it leaves the plate level, then eases out
 * and up to the name, an S with long, gentle bends. Flat xyz positions, for LineGeometry.
 */
function leader(curve: THREE.CubicBezierCurve3, h: number, plateY: number, out: number, tagY: number, sway = 0) {
  curve.v0.set(h, plateY, -h)
  curve.v1.set(h + out * 0.55, plateY, -h - out * 0.05)
  curve.v2.set(h + out * 0.45, tagY, -h - out * 0.95)
  curve.v3.set(h + out + sway, tagY, -h - out - sway)
  return curve.getPoints(40).flatMap((p) => [p.x, p.y, p.z])
}

/** An engine orbiting its plate; it brightens and names itself when its Stage is on. */
function Satellite({ y, phase, color, lit, label, reducedMotion }: { y: number; phase: number; color: string; lit: boolean; label: string; reducedMotion: boolean }) {
  const body = useRef<THREE.Mesh>(null)
  const radius = SLAB.size * 0.86
  useFrame(({ clock }) => {
    if (!body.current) return
    const a = phase + (reducedMotion ? 0 : clock.elapsedTime * 0.22)
    body.current.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius)
    body.current.rotation.y = a * 2
    body.current.scale.setScalar(THREE.MathUtils.lerp(body.current.scale.x, lit ? 1.6 : 1, 0.08))
  })
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, y, 0]}>
        <torusGeometry args={[radius, 0.01, 8, 160]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.55 : 0.1} />
      </mesh>
      <mesh ref={body}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 1.5 : 0.35} roughness={0.3} />
        {/* Always mounted, shown by opacity: mounting drei Html during a render warns in React 19. */}
        <Html position={[0, 0.55, 0]} center zIndexRange={[5, 0]} className="pointer-events-none">
          <p className={`rounded-full border border-white/20 bg-sc-midnight/80 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-sc-silver backdrop-blur transition-opacity duration-300 ${lit ? 'opacity-100' : 'opacity-0'}`}>
            {label}
          </p>
        </Html>
      </mesh>
    </group>
  )
}

/** The sources as tiles on the base, like the brand stack's foundation row. */
function SourceTiles({
  names,
  y,
  lit,
  faint,
  selected,
  onPick,
  onHover,
}: {
  names: string[]
  y: number
  lit: boolean
  faint: boolean
  selected: string | null
  onPick: (name: string) => (e: ThreeEvent<MouseEvent>) => void
  onHover: (on: boolean) => () => void
}) {
  const cols = names.length <= 6 ? 3 : 4
  const rows = Math.ceil(names.length / cols)
  const cell = SLAB.size / cols
  const tile = useMemo(() => new THREE.BoxGeometry(cell * 0.82, 0.12, cell * 0.62), [cell])
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={plateBody} scale={[1.05, 0.4, 1.05]}>
        <meshStandardMaterial color={LAYER.data_engine.base} emissive={LAYER.data_engine.base} emissiveIntensity={0.12} transparent opacity={0.18} depthWrite={false} />
        <Edges color={LAYER.data_engine.edge} transparent opacity={0.4} worldUnits lineWidth={EDGE} />
      </mesh>
      {names.map((n, i) => {
        const x = -SLAB.size / 2 + cell * ((i % cols) + 0.5)
        const z = -SLAB.size / 2 + (SLAB.size / rows) * (Math.floor(i / cols) + 0.5)
        return (
          <group key={`${n}-${i}`} position={[x, 0.12, z]}>
            <mesh geometry={tile} onClick={onPick(n)} onPointerOver={onHover(true)} onPointerOut={onHover(false)}>
              <meshStandardMaterial
                color={n === selected ? C.solar : LAYER.data_engine.base}
                emissive={n === selected ? C.solar : LAYER.data_engine.base}
                emissiveIntensity={n === selected ? 0.9 : faint ? 0.15 : lit ? 0.6 : 0.3}
                transparent
                opacity={faint && n !== selected ? 0.35 : 0.7}
                depthWrite={false}
              />
            </mesh>
            <Html position={[0, 0.1, cell * 0.36]} center zIndexRange={[5, 0]} className="pointer-events-none">
              <p className={`text-[10px] whitespace-nowrap ${faint ? 'text-sc-silver/45' : 'text-sc-silver/90'}`}>{n}</p>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/** A soft round sprite for the data particles. */
function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** Records rising from the sources through the Stack, up to the Stage the session has reached. */
function DataStream({ from, to, reducedMotion }: { from: number; to: number; reducedMotion: boolean }) {
  const count = 650
  const points = useRef<THREE.Points>(null)
  const { geometry, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SLAB.size * 0.8
      pos[i * 3 + 1] = from + Math.random() * (to - from + 0.4)
      pos[i * 3 + 2] = (Math.random() - 0.5) * SLAB.size * 0.8
      speeds[i] = 0.5 + Math.random() * 1.4
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { geometry, speeds }
    // Built once: the stream adapts its height every frame instead of being rebuilt.
  }, [])
  const map = useMemo(dotTexture, [])
  const limit = useRef(to)
  useFrame((_, dt) => {
    limit.current += (to + 0.3 - limit.current) * Math.min(1, dt * 2)
    if (reducedMotion || !points.current) return
    const attr = points.current.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      let yy = arr[i * 3 + 1]! + speeds[i]! * dt
      if (yy > limit.current) yy = from + Math.random() * 0.6
      arr[i * 3 + 1] = yy
    }
    attr.needsUpdate = true
  })
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial map={map} color={C.skyLight} size={0.075} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}
