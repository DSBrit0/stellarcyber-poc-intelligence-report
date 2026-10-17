import type { Chapter, SceneState, SceneTarget, StageId } from '@poc-intel/shared'
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import gsap from 'gsap'
import type { ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Chamber, CHAMBER } from './Chamber'
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

/** What powers each layer, as the Multi-Layer AI v4 brief names it. */
const ENABLEMENT: Record<Chapter, string[]> = {
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

/** The brand's six source families at the Stack's base, until the Customer's own Data Sources are approved. */
const DEFAULT_SOURCES = ['Identity', 'Network', 'Logs', 'SaaS / Cloud', 'Apps', 'Any EDR']

export interface StackSceneProps {
  stages: StageId[]
  current: StageId
  settled: ReadonlySet<StageId>
  /** The approved Data Sources: they take the place of the brand's source families at the base. */
  sources: string[]
  chapterTitles: Record<Chapter, string>
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
  /** In the trace model: the Stage the traced record has reached, or null before it starts. */
  traceStage: StageId | null
  /** Whether this viewer may enter objects: the Presenter, or anyone in a replay. */
  canInteract: boolean
  onEnter: (target: SceneTarget) => void
}

/**
 * The Multi-Layer AI™ Stack as the brand draws it: luminous frosted-glass plates, one per Stage,
 * grouped in three layers inside a translucent shell, over a Cube Blue to AI Purple volume.
 * The Presenter's Stage lifts and lights; data rises from the sources at the base up to it.
 */
export default function StackScene(props: StackSceneProps) {
  const layout = useMemo(() => stackLayout(props.stages), [props.stages])
  const focus = layout.slabs.find((s) => s.id === props.current)?.y ?? 0
  const bottom = layout.slabs[0]?.y ?? 0
  const top = layout.slabs[layout.slabs.length - 1]?.y ?? 0
  const ca = useRef<ChromaticAberrationEffect>(null)
  const offset = useMemo(() => new THREE.Vector2(0.0003, 0.00015), [])
  const sources = props.sources.length > 0 ? props.sources.slice(0, 12) : DEFAULT_SOURCES
  const target = props.scene.target
  const inChamber = props.scene.model === 'chamber' && target != null
  const tracing = props.scene.model === 'trace' && target != null
  const traceY = tracing ? (layout.slabs.find((s) => s.id === props.traceStage)?.y ?? bottom - 2.4) : null
  // A click, not the end of a drag: R3F reports how far the pointer travelled.
  const enter = (t: SceneTarget) => (e: ThreeEvent<MouseEvent>) => {
    if (!props.canInteract || e.delta > 4) return
    e.stopPropagation()
    props.onEnter(t)
  }
  const hover = (on: boolean) => () => {
    if (props.canInteract) document.body.style.cursor = on ? 'pointer' : ''
  }
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [16, 9, 16], near: 0.1, far: 140 }} gl={{ antialias: true, powerPreference: 'high-performance' }} style={{ position: 'absolute', inset: 0 }}>
      <fog attach="fog" args={[C.ground, 30, 70]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 14, 8]} intensity={0.8} color={C.silver} />
      <Framing shift={props.shift} shiftDown={props.shiftDown} />
      <Backdrop />
      <Shell bottom={bottom - 0.4} top={top + 0.4} />
      {layout.slabs.map((s) => (
        <Plate
          key={s.id}
          y={s.y}
          label={props.stageTitles[s.id]}
          state={s.id === props.current || (tracing && s.id === props.traceStage) ? 'lit' : props.settled.has(s.id) ? 'done' : 'idle'}
          reducedMotion={props.reducedMotion}
          onClick={enter({ kind: 'stage', key: s.id })}
          onHover={hover}
        />
      ))}
      {layout.chapters.map((c) => {
        const active = c.from <= focus + 0.01 && focus <= c.to + 0.01
        return (
          <Html key={c.chapter} position={[-SLAB.size / 2 - 0.6, (c.from + c.to) / 2, SLAB.size / 2 + 0.6]} zIndexRange={[5, 0]} className="pointer-events-none">
            <div className={`-translate-x-full -translate-y-1/2 pr-3 text-right transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-45'}`}>
              <p className="text-sm font-semibold whitespace-nowrap text-sc-silver">{props.chapterTitles[c.chapter]}</p>
              <p className="mt-1 flex justify-end gap-1">
                {ENABLEMENT[c.chapter].map((e) => (
                  <span key={e} className="rounded border border-white/20 px-1.5 text-[10px] whitespace-nowrap text-sc-silver/70">
                    {e}
                  </span>
                ))}
              </p>
            </div>
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
      {traceY != null ? <TracedRecord y={traceY} reducedMotion={props.reducedMotion} /> : null}
      {inChamber ? <Chamber stage={target.kind === 'stage' ? (target.key as StageId) : null} reducedMotion={props.reducedMotion} /> : null}
      {/* Aim halfway between the Stack's middle and the lit plate: the whole Stack stays in frame. */}
      <CameraRig focusY={((traceY ?? focus) + (top + bottom) / 2) / 2} distance={tracing ? 38 : props.wide ? 38 : 34} chamber={inChamber} reducedMotion={props.reducedMotion} aberration={ca} />
      <OrbitControls makeDefault enabled={!inChamber} enablePan={false} enableDamping minDistance={14} maxDistance={44} minPolarAngle={0.55} maxPolarAngle={1.45} />
      {/* MSAA keeps the plate edges and lines clean; bloom only catches what is truly bright. */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.82} luminanceSmoothing={0.15} />
        <ChromaticAberration ref={ca} offset={offset} radialModulation={false} modulationOffset={0} />
        <Vignette darkness={0.6} offset={0.28} />
      </EffectComposer>
    </Canvas>
  )
}

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

/** On every Stage change the camera glides to the lit plate, with a brief chromatic aberration as it accelerates. */
function CameraRig({
  focusY,
  distance,
  chamber,
  reducedMotion,
  aberration,
}: {
  focusY: number
  distance: number
  chamber: boolean
  reducedMotion: boolean
  aberration: RefObject<ChromaticAberrationEffect | null>
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => {
    if (!controls) return
    const dir = new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(distance)
    // Inside a chamber the camera sits at the tunnel's mouth, looking down it towards the engine.
    const target = chamber ? CHAMBER.look : { x: 0, y: focusY, z: 0 }
    const pos = chamber ? CHAMBER.eye : { x: dir.x, y: focusY + dir.y, z: dir.z }
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
  }, [focusY, distance, chamber, controls, camera, reducedMotion, aberration])
  return null
}

/**
 * The space around the Stack (Multi-Layer AI v4 cover): an opaque sky, near-black, with a soft
 * Cube Blue glow behind the Stack and a hint of AI Purple below it. Opaque and dim on purpose: the
 * colour is atmosphere, never a veil over the plates.
 */
function Backdrop() {
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

/** The Stack's translucent housing, with the peaked roof of the brand drawing. */
function Shell({ bottom, top }: { bottom: number; top: number }) {
  const geometry = useMemo(() => {
    const h = SLAB.size / 2 + 0.35
    const roof = top + 1.6
    const c = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const corners = [c(h, 0, h), c(-h, 0, h), c(-h, 0, -h), c(h, 0, -h)]
    const pts: THREE.Vector3[] = []
    corners.forEach((p, i) => {
      const q = corners[(i + 1) % 4]!
      pts.push(c(p.x, bottom, p.z), c(q.x, bottom, q.z)) // base
      pts.push(c(p.x, top, p.z), c(q.x, top, q.z)) // eaves
      pts.push(c(p.x, bottom, p.z), c(p.x, top, p.z)) // pillars
      pts.push(c(p.x, top, p.z), c(0, roof, 0)) // roof
    })
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [bottom, top])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={C.silver} transparent opacity={0.09} />
    </lineSegments>
  )
}

const plateBody = new THREE.BoxGeometry(SLAB.size, SLAB.thickness, SLAB.size)
const plateTop = new THREE.PlaneGeometry(SLAB.size * 1.08, SLAB.size * 1.08)

/** A plate's top: frosted glass whose light fades towards the edges, as in the brand's stack drawings. */
function plateMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(C.silver) }, uOpacity: { value: 0.12 }, uTint: { value: new THREE.Color(C.skyLight) }, uLit: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uTint; uniform float uOpacity; uniform float uLit; varying vec2 vUv;
      void main(){
        vec2 d = abs(vUv - 0.5) * 2.0;
        float edge = max(d.x, d.y);
        float body = 1.0 - smoothstep(0.62, 0.98, edge);
        float rim = smoothstep(0.84, 0.92, edge) * (1.0 - smoothstep(0.92, 0.99, edge));
        float centre = 1.0 - length(vUv - 0.5) * 0.9;
        vec3 c = mix(uColor * 0.82, uTint, uLit * 0.45) * (0.7 + 0.3 * centre);
        gl_FragColor = vec4(c, (body * 0.7 + rim * 0.5) * uOpacity);
      }`,
  })
}

/** One Stage: lifted and lit when it is the Presenter's, brighter once settled, named on its right corner. */
function Plate({
  y,
  label,
  state,
  reducedMotion,
  onClick,
  onHover,
}: {
  y: number
  label: string
  state: 'lit' | 'done' | 'idle'
  reducedMotion: boolean
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onHover: (on: boolean) => () => void
}) {
  const group = useRef<THREE.Group>(null)
  const top = useMemo(plateMaterial, [])
  const body = useRef<THREE.MeshStandardMaterial>(null)
  const goal = {
    y: y + (state === 'lit' ? 0.24 : 0),
    opacity: state === 'lit' ? 0.62 : state === 'done' ? 0.3 : 0.13,
    lit: state === 'lit' ? 1 : 0,
    body: state === 'lit' ? 0.2 : state === 'done' ? 0.1 : 0.05,
  }
  useFrame((_, dt) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 5)
    if (group.current) group.current.position.y += (goal.y - group.current.position.y) * k
    const u = top.uniforms
    u.uOpacity!.value += (goal.opacity - u.uOpacity!.value) * k
    u.uLit!.value += (goal.lit - u.uLit!.value) * k
    if (body.current) body.current.opacity += (goal.body - body.current.opacity) * k
  })
  return (
    <group ref={group} position={[0, y, 0]}>
      <mesh geometry={plateBody} onClick={onClick} onPointerOver={onHover(true)} onPointerOut={onHover(false)}>
        <meshStandardMaterial ref={body} color={C.silver} emissive={C.cube} emissiveIntensity={0.08} transparent opacity={0.05} roughness={0.1} metalness={0} depthWrite={false} />
      </mesh>
      <mesh geometry={plateTop} material={top} rotation={[-Math.PI / 2, 0, 0]} position={[0, SLAB.thickness / 2 + 0.002, 0]} />
      <Html position={[SLAB.size / 2 + 0.25, 0, -SLAB.size / 2 + 0.6]} zIndexRange={[5, 0]} className="pointer-events-none">
        <p
          className={`-translate-y-1/2 text-[13px] whitespace-nowrap transition-all duration-500 ${state === 'lit' ? 'text-sm font-semibold text-sc-silver' : state === 'done' ? 'text-sc-silver/75' : 'text-sc-silver/50'}`}
        >
          {label}
        </p>
      </Html>
    </group>
  )
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
      <mesh geometry={plateBody} scale={[1.05, 0.5, 1.05]}>
        <meshStandardMaterial color={C.silver} emissive={C.cube} emissiveIntensity={0.1} transparent opacity={0.05} depthWrite={false} />
      </mesh>
      {names.map((n, i) => {
        const x = -SLAB.size / 2 + cell * ((i % cols) + 0.5)
        const z = -SLAB.size / 2 + (SLAB.size / rows) * (Math.floor(i / cols) + 0.5)
        return (
          <group key={`${n}-${i}`} position={[x, 0.12, z]}>
            <mesh geometry={tile} onClick={onPick(n)} onPointerOver={onHover(true)} onPointerOut={onHover(false)}>
              <meshStandardMaterial
                color={n === selected ? C.solar : C.silver}
                emissive={n === selected ? C.solar : C.skyLight}
                emissiveIntensity={n === selected ? 0.9 : faint ? 0.1 : lit ? 0.55 : 0.25}
                transparent
                opacity={faint && n !== selected ? 0.25 : 0.6}
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

/** The one record being traced: a bright point that climbs to the plate of the engine now at work. */
function TracedRecord({ y, reducedMotion }: { y: number; reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    if (!mesh.current) return
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 3)
    mesh.current.position.y += (y + 0.45 - mesh.current.position.y) * k
    if (halo.current) {
      halo.current.position.y = mesh.current.position.y
      halo.current.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 4) * 0.15))
    }
  })
  return (
    <group>
      <mesh ref={mesh} position={[0, y, 0]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color={C.solar} emissive={C.solar} emissiveIntensity={1.6} />
      </mesh>
      <mesh ref={halo} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.55, 48]} />
        <meshBasicMaterial color={C.solar} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
