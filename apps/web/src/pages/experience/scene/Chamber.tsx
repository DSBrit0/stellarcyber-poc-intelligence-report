import type { StageId } from '@poc-intel/shared'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * The Engine Chamber (CONTEXT.md): entering an object takes the camera into a tunnel, far from the
 * Stack, where raw records stream towards the engine's ring and leave it as Interflow.
 */
const ORIGIN = new THREE.Vector3(90, 0, 0)
const LENGTH = 46
/** The ring sits here along the tunnel (0 = mouth, 1 = far end). */
const RING_AT = 0.42

const curve = new THREE.CatmullRomCurve3(
  Array.from({ length: 9 }, (_, i) => {
    const t = i / 8
    return new THREE.Vector3(ORIGIN.x + Math.sin(t * Math.PI * 1.3) * 2.2, ORIGIN.y + Math.sin(t * Math.PI) * 1.4, ORIGIN.z + LENGTH / 2 - t * LENGTH)
  }),
)

export const CHAMBER = {
  eye: (() => {
    const p = curve.getPointAt(0.02)
    return { x: p.x, y: p.y + 0.3, z: p.z }
  })(),
  // Aimed above the ring, so the ring sits low on screen, clear of the panel at the top.
  look: (() => {
    const p = curve.getPointAt(RING_AT)
    return { x: p.x, y: p.y + 1.5, z: p.z }
  })(),
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

/** The engine's name is shown by the page beside the scene, not as a 3D label. */
export function Chamber({ stage, reducedMotion }: { stage: StageId | null; reducedMotion: boolean }) {
  const ringColor = (stage && RING_COLOR[stage]) ?? C.skyLight
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
            float fade = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
            vec3 c = uColor * 0.12 + uLine * line * 0.6;
            gl_FragColor = vec4(c, (0.08 + line * 0.4) * fade);
          }`,
      }),
    [],
  )
  const ringPos = useMemo(() => curve.getPointAt(RING_AT), [])
  const ringDir = useMemo(() => curve.getTangentAt(RING_AT), [])
  const ringQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringDir), [ringDir])
  const ring = useRef<THREE.Mesh>(null)

  // Packets: white while raw, Light Sky Blue once the engine has turned them into Interflow.
  const count = 90
  const packets = useRef<THREE.InstancedMesh>(null)
  const state = useMemo(() => Array.from({ length: count }, () => ({ t: Math.random(), speed: 0.035 + Math.random() * 0.05, r: 0.5 + Math.random() * 1.3, a: Math.random() * Math.PI * 2 })), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const raw = useMemo(() => new THREE.Color(C.silver), [])
  const done = useMemo(() => new THREE.Color(ringColor), [ringColor])

  useFrame(({ clock }, dt) => {
    wall.uniforms.uTime!.value = reducedMotion ? 0 : clock.elapsedTime
    if (ring.current) ring.current.rotation.z += reducedMotion ? 0 : dt * 0.6
    const mesh = packets.current
    if (!mesh) return
    state.forEach((p, i) => {
      // Start past the camera so nothing flies through the lens.
      if (!reducedMotion) p.t = p.t + p.speed * dt > 0.95 ? 0.08 : p.t + p.speed * dt
      const at = curve.getPointAt(Math.max(p.t, 0.08))
      dummy.position.set(at.x + Math.cos(p.a) * p.r, at.y + Math.sin(p.a) * p.r, at.z)
      // Raw records are thin streaks of light; past the ring they become small, flat Interflow cards.
      const after = p.t > RING_AT
      dummy.scale.set(after ? 0.16 : 0.035, after ? 0.03 : 0.035, after ? 0.22 : 0.7)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, after ? done : raw)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={tube} material={wall} />
      <group position={ringPos} quaternion={ringQuat}>
        <mesh ref={ring}>
          <torusGeometry args={[2.1, 0.07, 16, 120]} />
          <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={1.3} />
        </mesh>
        <mesh>
          <circleGeometry args={[2.05, 64]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <instancedMesh ref={packets} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        {/* Unlit, so each packet shows exactly its instance colour (raw or Interflow). */}
        <meshBasicMaterial />
      </instancedMesh>
      <pointLight position={ringPos} color={ringColor} intensity={10} distance={14} />
    </group>
  )
}
