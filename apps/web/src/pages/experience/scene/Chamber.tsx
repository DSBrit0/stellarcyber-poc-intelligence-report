import type { StageId } from '@poc-intel/shared'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * The tunnel, far from the Stack, that both ways into an object use (CONTEXT.md). Data ingestion
 * (Engine Chamber): raw records stream towards one engine's ring and leave it as Interflow. Pipeline
 * (Record Trace): one ring per engine along the tunnel, and the traced record flies from ring to ring.
 */
const ORIGIN = new THREE.Vector3(90, 0, 0)
const LENGTH = 46
/** The ring sits here along the tunnel (0 = mouth, 1 = far end). */
const RING_AT = 0.5

const curve = new THREE.CatmullRomCurve3(
  Array.from({ length: 9 }, (_, i) => {
    const t = i / 8
    return new THREE.Vector3(ORIGIN.x + Math.sin(t * Math.PI * 1.3) * 2.2, ORIGIN.y + Math.sin(t * Math.PI) * 1.4, ORIGIN.z + LENGTH / 2 - t * LENGTH)
  }),
)

/** Where the rings sit along the tunnel: one in the chamber, spread out towards the far end in the pipeline. */
export const ringStops = (n: number) => (n <= 1 ? [RING_AT] : Array.from({ length: n }, (_, i) => 0.3 + (0.62 * i) / (n - 1)))

/**
 * The camera some way before a ring, aimed at its centre: the ring sits mid-height, small enough to fit
 * between the text box and the panel. In the chamber it is the mouth of the tunnel; in the pipeline it
 * follows the record.
 */
export function tubeView(ringAt: number) {
  const eye = curve.getPointAt(Math.max(0.02, ringAt - 0.48))
  const look = curve.getPointAt(ringAt)
  return { eye: { x: eye.x, y: eye.y + 0.3, z: eye.z }, look: { x: look.x, y: look.y, z: look.z } }
}

const C = { cube: '#2059E0', skyLight: '#41C5F9', silver: '#C9CCD6', purple: '#9320E0', solar: '#FF9B1D', burnt: '#F05B2A' }

/** The ring's colour says what kind of engine it is: AI Purple for ML, orange for threat, blue otherwise. */
const RING_COLOR: Partial<Record<StageId, string>> = {
  threat_intel: C.solar,
  sandbox: C.burnt,
  itdr_ueba: C.purple,
  detection: C.purple,
  correlation: C.purple,
  agentic_soc: C.purple,
}

/**
 * The engines' names are shown by the page beside the scene, not as 3D labels. `traced`: in the
 * pipeline, the engine the record has reached (its ring lit, the others dim); null in the chamber.
 */
export function Chamber({ stages, traced, reducedMotion }: { stages: (StageId | null)[]; traced: number | null; reducedMotion: boolean }) {
  const stops = useMemo(() => ringStops(stages.length), [stages.length])
  const colors = stages.map((s) => (s && RING_COLOR[s]) ?? C.skyLight)
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 240, 2.6, 48, false), [])
  const wall = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(C.cube) }, uLine: { value: new THREE.Color(C.skyLight) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        // A lattice that drifts towards the viewer: speed without a single moving mesh.
        fragmentShader: `
          uniform float uTime; uniform vec3 uColor; uniform vec3 uLine; varying vec2 vUv;
          void main(){
            float along = fract(vUv.x * 60.0 + uTime * 0.6);
            float around = fract(vUv.y * 24.0);
            float line = smoothstep(0.96, 1.0, along) + smoothstep(0.97, 1.0, around) * 0.6;
            float fade = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
            vec3 c = uColor * 0.12 + uLine * line * 0.6;
            gl_FragColor = vec4(c, (0.08 + line * 0.4) * fade);
          }`,
      }),
    [],
  )

  // Packets: white while raw, then the colour of the last ring they crossed.
  const count = 90
  const packets = useRef<THREE.InstancedMesh>(null)
  const state = useMemo(() => Array.from({ length: count }, () => ({ t: Math.random(), speed: 0.035 + Math.random() * 0.05, r: 0.5 + Math.random() * 1.3, a: Math.random() * Math.PI * 2 })), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const raw = useMemo(() => new THREE.Color(C.silver), [])
  const colorKey = colors.join()
  const tints = useMemo(() => colorKey.split(',').map((c) => new THREE.Color(c)), [colorKey])

  // The traced record: a bright Solar Orange point gliding to the ring of the engine at work.
  const record = useRef<THREE.Group>(null)
  const recordAt = useRef(0.08)
  const recordGoal = traced != null ? (stops[traced] ?? stops[0]!) - 0.004 : null

  useFrame(({ clock }, dt) => {
    wall.uniforms.uTime!.value = reducedMotion ? 0 : clock.elapsedTime
    const mesh = packets.current
    if (mesh) {
      state.forEach((p, i) => {
        // Start past the camera so nothing flies through the lens.
        if (!reducedMotion) p.t = p.t + p.speed * dt > 0.97 ? 0.08 : p.t + p.speed * dt
        const at = curve.getPointAt(Math.max(p.t, 0.08))
        dummy.position.set(at.x + Math.cos(p.a) * p.r, at.y + Math.sin(p.a) * p.r, at.z)
        // Raw records are thin streaks of light; past a ring they become small, flat Interflow cards.
        let crossed = -1
        stops.forEach((s, k) => p.t > s && (crossed = k))
        const after = crossed >= 0
        dummy.scale.set(after ? 0.16 : 0.035, after ? 0.03 : 0.035, after ? 0.22 : 0.7)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, after ? tints[crossed]! : raw)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    if (record.current && recordGoal != null) {
      recordAt.current += (recordGoal - recordAt.current) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 1.6))
      const p = curve.getPointAt(THREE.MathUtils.clamp(recordAt.current, 0, 1))
      record.current.position.copy(p)
      record.current.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 5) * 0.12))
    }
  })

  return (
    <group>
      <mesh geometry={tube} material={wall} />
      {stops.map((t, i) => (
        <Ring key={i} at={t} color={colors[i]!} lit={traced == null || i === traced} passed={traced != null && i < traced} reducedMotion={reducedMotion} />
      ))}
      <instancedMesh ref={packets} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        {/* Unlit, so each packet shows exactly its instance colour (raw or Interflow). */}
        <meshBasicMaterial />
      </instancedMesh>
      {traced != null ? (
        <group ref={record} position={curve.getPointAt(0.08)}>
          <mesh>
            <sphereGeometry args={[0.32, 24, 24]} />
            <meshStandardMaterial color={C.solar} emissive={C.solar} emissiveIntensity={2} />
          </mesh>
          <pointLight color={C.solar} intensity={6} distance={8} />
        </group>
      ) : null}
    </group>
  )
}

/** One engine's ring across the tunnel: bright while its engine is at work, dimmer once the record has passed. */
function Ring({ at, color, lit, passed, reducedMotion }: { at: number; color: string; lit: boolean; passed: boolean; reducedMotion: boolean }) {
  const pos = useMemo(() => curve.getPointAt(at), [at])
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(at)), [at])
  const ring = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ring.current && !reducedMotion) ring.current.rotation.z += dt * (lit ? 0.6 : 0.15)
  })
  return (
    <group position={pos} quaternion={quat}>
      <mesh ref={ring}>
        <torusGeometry args={[2.1, lit ? 0.08 : 0.04, 16, 120]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 1.4 : passed ? 0.6 : 0.3} transparent opacity={lit ? 1 : passed ? 0.75 : 0.45} />
      </mesh>
      <mesh>
        <circleGeometry args={[2.05, 64]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.08 : 0.025} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {lit ? <pointLight color={color} intensity={10} distance={14} /> : null}
    </group>
  )
}
