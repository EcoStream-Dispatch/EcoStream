import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { WHEEL_R, useTyreGeometry } from './Truck'
import { DEMO_CRITICAL_PSI, DEMO_RECOMMENDED_PSI, ease, heatNow, hotLeakAt, story } from './store'

/*
 * "Hot is not a leak": two big tyres on a podium beside the road.
 * Both heat up as you drive (slider or scroll). The hot one keeps its air, so its
 * corrected pressure stays flat (no alarm). The other loses 3 psi/hour, so its corrected
 * pressure falls and a slow-leak alert fires. Correction = api/alert_logic.py.
 */

export const PODIUM = new THREE.Vector3(7.2, 0, 1.2)
const SCALE = 1.7
const GAP = 1.75 // half distance between the two tyres (along z)

const ringVertex = /* glsl */ `
  varying vec2 vPos;
  void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const ringFragment = /* glsl */ `
  uniform float uFill; uniform float uAlpha; uniform vec3 uColor; varying vec2 vPos;
  void main() {
    float a = fract(0.5 - atan(vPos.x, vPos.y) / 6.28318);
    float on = step(a, uFill);
    gl_FragColor = vec4(mix(vec3(1.0), uColor, on), mix(0.25, 0.95, on) * uAlpha);
    #include <colorspace_fragment>
  }
`

function ShowTyre({ kind }: { kind: 'hot' | 'leak' }) {
  const geo = useTyreGeometry()
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.85, emissive: '#ff5a00', emissiveIntensity: 0 }), [])
  const rim = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 0.85, roughness: 0.3 }), [])
  const spin = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uFill: { value: 1 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color('#5C9A35').convertSRGBToLinear() } },
      }),
    [],
  )
  const green = useMemo(() => new THREE.Color('#5C9A35').convertSRGBToLinear(), [])
  const amber = useMemo(() => new THREE.Color('#E0A100').convertSRGBToLinear(), [])
  const lugs = useMemo(() => Array.from({ length: 30 }, (_, i) => (i / 30) * Math.PI * 2), [])

  useFrame((state, dt) => {
    const v = hotLeakAt(heatNow())
    const t = kind === 'hot' ? v.hot : v.leak
    const heat = (t.temp - 30) / 55
    rubber.emissiveIntensity = heat * 0.32
    if (spin.current) spin.current.rotation.x += dt * 0.25
    const fill = (t.corrected - DEMO_CRITICAL_PSI) / (DEMO_RECOMMENDED_PSI - DEMO_CRITICAL_PSI)
    ringMat.uniforms.uFill.value = Math.min(1, Math.max(0, fill))
    const alarm = kind === 'leak' && v.alert
    ringMat.uniforms.uColor.value.copy(alarm ? amber : green)
    ringMat.uniforms.uAlpha.value = ease(story.progress.hotleak, 0.04, 0.14) * (1 - ease(story.progress.journey, 0.0, 0.15))
    if (label.current) {
      label.current.style.opacity = String(ringMat.uniforms.uAlpha.value)
      label.current.dataset.state = alarm ? 'alert' : 'ok'
      const g = label.current.querySelector<HTMLElement>('[data-g]')
      const c = label.current.querySelector<HTMLElement>('[data-c]')
      const tt = label.current.querySelector<HTMLElement>('[data-t]')
      const s = label.current.querySelector<HTMLElement>('[data-s]')
      if (g) g.textContent = `${t.gauge.toFixed(1)} psi`
      if (c) c.textContent = `${t.corrected.toFixed(1)} psi`
      if (tt) tt.textContent = `${Math.round(t.temp)} °C`
      if (s) s.textContent = alarm ? 'Slow-leak alert' : kind === 'leak' ? 'Watching…' : 'No alarm: just heat'
    }
    void state
  })

  return (
    <group>
      <group ref={spin} scale={SCALE} position={[0, WHEEL_R * SCALE, 0]}>
        <mesh geometry={geo} material={rubber} castShadow />
        {lugs.map((a, i) => (
          <mesh key={i} position={[i % 2 ? 0.07 : -0.07, Math.cos(a) * (WHEEL_R + 0.005), Math.sin(a) * (WHEEL_R + 0.005)]} rotation={[a, 0, 0]} material={rubber}>
            <boxGeometry args={[0.13, 0.03, 0.06]} />
          </mesh>
        ))}
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={rim}>
          <cylinderGeometry args={[0.33, 0.33, 0.06, 32]} />
        </mesh>
        <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={rim}>
          <cylinderGeometry args={[0.13, 0.16, 0.06, 24]} />
        </mesh>
      </group>
      {/* pressure ring, facing the camera side (+x) */}
      <mesh position={[0.45 * SCALE, WHEEL_R * SCALE, 0]} rotation={[0, Math.PI / 2, 0]} material={ringMat} renderOrder={5}>
        <ringGeometry args={[0.66 * SCALE, 0.74 * SCALE, 96]} />
      </mesh>
      <Html position={[0.3, WHEEL_R * SCALE * 2 + 0.55, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={label}
          className="group w-44 rounded-xl bg-white/95 p-2.5 font-sans text-navy-900 shadow-lg ring-1 ring-green-500/40 data-[state=alert]:ring-2 data-[state=alert]:ring-warning"
        >
          <p className="font-heading text-[11px] font-extrabold uppercase tracking-wider">
            {kind === 'hot' ? 'Hot tyre, no leak' : 'Leaking tyre'}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[11px]">
            <dt className="text-navy-700">Temp</dt>
            <dd data-t className="text-right font-semibold tabular-nums" />
            <dt className="text-navy-700">Gauge</dt>
            <dd data-g className="text-right font-semibold tabular-nums" />
            <dt className="text-navy-700">Corrected</dt>
            <dd data-c className="text-right font-bold tabular-nums text-green-700" />
          </dl>
          <p
            data-s
            className="mt-1.5 rounded bg-green-50 px-1.5 py-0.5 text-center text-[11px] font-bold text-green-700 group-data-[state=alert]:bg-warning group-data-[state=alert]:text-navy-900"
          />
        </div>
      </Html>
    </group>
  )
}

export default function HotLeakScene() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const show = ease(story.progress.hotleak, 0.0, 0.12) * (1 - ease(story.progress.journey, 0.05, 0.25))
    if (ref.current) {
      ref.current.visible = show > 0.001
      ref.current.scale.setScalar(0.001 + show * 0.999)
    }
  })
  return (
    <group ref={ref} position={PODIUM.toArray()} visible={false}>
      {/* podium */}
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.4, 3.6, 0.16, 64]} />
        <meshStandardMaterial color="#F4F9F1" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[3.42, 3.42, 0.02, 64]} />
        <meshStandardMaterial color="#5C9A35" roughness={0.5} />
      </mesh>
      <group position={[0, 0.18, -GAP]}>
        <ShowTyre kind="hot" />
      </group>
      <group position={[0, 0.18, GAP]}>
        <ShowTyre kind="leak" />
      </group>
      <RoundedBox args={[0.1, 0.04, 5.6]} radius={0.02} position={[2.9, 0.2, 0]}>
        <meshStandardMaterial color="#0B1E36" />
      </RoundedBox>
    </group>
  )
}
