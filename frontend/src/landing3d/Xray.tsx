import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { REAR_AXLE_Z, TYRES, WHEEL_R, type TruckMaterials } from './Truck'
import { DEMO_CRITICAL_PSI, DEMO_RECOMMENDED_PSI, DEMO_TYRES, ease, leakAt, lerp, story } from './store'

/*
 * Phase 2 scenes:
 *  - X-ray: the body fades to glass, the tyres glow green, a sensor dot and a label
 *    (corrected psi, °C) appear on each tyre.
 *  - Slow leak: RL-O turns amber, a pressure ring around it drains while we
 *    fast-forward a 3 psi/hour leak (numbers from store.leakAt, shown as demo values).
 */

const GREEN = new THREE.Color('#5C9A35')
const AMBER = new THREE.Color('#E0A100')
const LEAK_TYRE = 'RL-O'

/** One rubber material per tyre, so each can glow on its own. */
export function useTyreMaterials() {
  return useMemo(
    () =>
      Object.fromEntries(
        TYRES.map((t) => [t.id, new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.9, emissive: '#000000' })]),
      ) as Record<string, THREE.MeshStandardMaterial>,
    [],
  )
}

/** Body parts that turn to glass in the X-ray. */
const GLASS_KEYS = ['cab', 'cabLower', 'stripe', 'body', 'bodyRib', 'tarp', 'glass', 'dark', 'chrome', 'head', 'amber', 'tail', 'chassis', 'rim'] as const
/** X-ray glass tint: light mint, a little self-lit so it reads as a clear shell in daylight. */
const GLASS_TINT = new THREE.Color('#e6f3e1')

/** Drives material opacity / glow from the scroll progress. Render once inside the Canvas. */
export function XrayController({ materials, tyres }: { materials: TruckMaterials; tyres: Record<string, THREE.MeshStandardMaterial> }) {
  // Set transparency once so changing opacity later doesn't recompile shaders; remember colours
  const base = useMemo(() => {
    const out: Record<string, { color: THREE.Color; emissive: THREE.Color; ei: number }> = {}
    GLASS_KEYS.forEach((k) => {
      const m = materials[k] as THREE.MeshStandardMaterial
      m.transparent = true
      out[k] = { color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity }
    })
    return out
  }, [materials])

  useFrame((state) => {
    const x = ease(story.progress.xray, 0.05, 0.45) // body -> glass
    const leakIn = ease(story.progress.leak, 0.0, 0.15)
    // Stay in X-ray during the leak scene, then slowly return to solid for later scenes
    const glass = Math.max(x, 0) * (1 - ease(story.progress.hotleak, 0.0, 0.2))
    // Signal journey: clear windscreen so the in-cab unit can be seen
    const clear = ease(story.progress.journey, 0, 0.1) * (1 - ease(story.progress.map, 0, 0.2))
    GLASS_KEYS.forEach((k) => {
      const m = materials[k] as THREE.MeshStandardMaterial
      let o = lerp(1, k === 'glass' ? 0.08 : 0.16, glass)
      if (k === 'glass') o = Math.min(o, lerp(1, 0.18, clear))
      m.opacity = o
      m.depthWrite = o > 0.97
      m.color.copy(base[k].color).lerp(GLASS_TINT, glass * 0.85)
      m.emissive.copy(base[k].emissive).lerp(GLASS_TINT, glass)
      m.emissiveIntensity = lerp(base[k].ei, 0.35, glass)
    })
    const pulse = 0.75 + Math.sin(state.clock.elapsedTime * 4) * 0.25
    TYRES.forEach((t) => {
      const m = tyres[t.id]
      if (t.id === LEAK_TYRE && leakIn > 0) {
        m.emissive.copy(GREEN).lerp(AMBER, leakIn)
        m.emissiveIntensity = glass * (0.7 + leakIn * 0.25 * pulse)
      } else {
        m.emissive.copy(GREEN)
        m.emissiveIntensity = glass * 0.8
      }
    })
  })
  return null
}

/** Sensor dot + label on each tyre. Rendered inside the truck's group so it moves with it. */
export function Sensors() {
  return (
    <>
      {TYRES.map((t) => (
        <Sensor key={t.id} id={t.id} x={t.x} z={t.z} />
      ))}
      <PressureRing />
    </>
  )
}

function Sensor({ id, x, z }: { id: string; x: number; z: number }) {
  const dot = useRef<THREE.Mesh>(null)
  const label = useRef<HTMLDivElement>(null)
  const value = useRef<HTMLSpanElement>(null)
  const side = x > 0 ? 1 : -1
  const isLeak = id === LEAK_TYRE
  const demo = DEMO_TYRES[id]
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#8CC152', transparent: true }), [])
  // Dual rear tyres: inner labels sit lower and further back, outer ones higher, so they don't overlap
  const inner = Math.abs(x) < 1.1 && z < 0
  const outer = Math.abs(x) > 1.2 && z < 0
  const labelOffset = inner ? -0.7 : 0
  const labelY = WHEEL_R + (outer ? 0.95 : inner ? 0.45 : 0.55)

  useFrame((state) => {
    const show = ease(story.progress.xray, 0.25, 0.55) * (1 - ease(story.progress.hotleak, 0, 0.15))
    const leakIn = ease(story.progress.leak, 0, 0.15)
    const s = 0.8 + Math.sin(state.clock.elapsedTime * 5 + x * 3) * 0.2
    if (dot.current) {
      dot.current.scale.setScalar(show * s)
      mat.color.set(isLeak && leakIn > 0.5 ? '#E0A100' : '#8CC152')
    }
    if (label.current) {
      label.current.style.opacity = String(show)
      label.current.style.display = show < 0.01 ? 'none' : 'block'
      label.current.dataset.state = isLeak && leakIn > 0.5 ? 'warning' : 'ok'
    }
    if (isLeak && value.current) {
      const psi = leakIn > 0 ? leakAt(story.progress.leak).psi : demo.psi
      value.current.textContent = `${psi.toFixed(1)} psi · ${demo.temp} °C`
    }
  })

  return (
    <group position={[x + side * 0.22, WHEEL_R, z]}>
      <mesh ref={dot} material={mat}>
        <sphereGeometry args={[0.07, 16, 16]} />
      </mesh>
      <Html position={[side * 0.1, labelY, labelOffset]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={label}
          className="whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 font-sans text-[11px] font-semibold text-navy-900 shadow-md ring-1 ring-green-500/40 transition-colors data-[state=warning]:bg-warning data-[state=warning]:ring-warning"
          style={{ opacity: 0, display: 'none' }}
        >
          <span className="mr-1 font-heading font-extrabold">{id}</span>
          <span ref={value}>
            {demo.psi.toFixed(1)} psi · {demo.temp} °C
          </span>
        </div>
      </Html>
    </group>
  )
}

const ringVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ringFragment = /* glsl */ `
  uniform float uFill;
  uniform float uAlpha;
  uniform vec3 uColor;
  varying vec2 vPos;
  void main() {
    // angle from the top, going round: 0..1
    float a = atan(vPos.x, vPos.y) / 6.28318 + 0.5;
    a = fract(1.0 - a + 0.5);
    float on = step(a, uFill);
    vec3 col = mix(vec3(1.0), uColor, on);
    float alpha = mix(0.22, 0.95, on) * uAlpha;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`

/** Ring around RL-O showing how much pressure is left before it is unsafe. */
function PressureRing() {
  const ref = useRef<THREE.Group>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uFill: { value: 1 },
          uAlpha: { value: 0 },
          uColor: { value: new THREE.Color('#E0A100').convertSRGBToLinear() },
        },
      }),
    [],
  )
  const t = TYRES.find((x) => x.id === LEAK_TYRE)!
  useFrame(() => {
    const p = story.progress.leak
    const show = ease(p, 0.02, 0.12) * (1 - ease(story.progress.hotleak, 0, 0.15))
    const { psi } = leakAt(p)
    // Full ring = recommended pressure, empty = critical (80%)
    mat.uniforms.uFill.value = Math.min(1, Math.max(0, (psi - DEMO_CRITICAL_PSI) / (DEMO_RECOMMENDED_PSI - DEMO_CRITICAL_PSI)))
    mat.uniforms.uAlpha.value = show
    if (ref.current) ref.current.visible = show > 0.001
  })
  return (
    <group ref={ref} position={[t.x + 0.3, WHEEL_R, REAR_AXLE_Z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh material={mat} renderOrder={5}>
        <ringGeometry args={[0.7, 0.8, 96]} />
      </mesh>
    </group>
  )
}
