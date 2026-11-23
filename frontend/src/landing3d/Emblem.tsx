import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { PILLARS } from '../pages/LandingPage'
import { ease, story } from './store'

/*
 * The five pillars: a 3D version of our leaf-shaped "E" turns in the sky, then five pillar
 * tokens fly out of it into a ring, each with its icon and name (HTML, so it stays crisp).
 * It floats where the corridor map was, so the camera only has to turn a little.
 */

export const EMBLEM_CENTER = new THREE.Vector3(4, 60, -30)
const RING = 5.4

/** Leaf outline, pointed at the top, as a 2D shape to extrude. */
function useLeafGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, -2.6)
    s.bezierCurveTo(2.6, -2.2, 2.9, 1.0, 0.2, 2.9)
    s.bezierCurveTo(-0.4, 3.2, -0.2, 3.1, -0.2, 2.9)
    s.bezierCurveTo(-2.9, 1.0, -2.6, -2.2, 0, -2.6)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 6, curveSegments: 48 })
    g.center()
    return g
  }, [])
}

function Token({ i, title, Icon }: { i: number; title: string; Icon: (typeof PILLARS)[number]['icon'] }) {
  const ref = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + Math.PI // start at the bottom, go round
  useFrame((state) => {
    const p = story.progress.pillars
    // each token flies out a little after the previous one
    const t = ease(p, 0.15 + i * 0.07, 0.45 + i * 0.07) * (1 - ease(story.progress.roles, 0.0, 0.3))
    const g = ref.current
    if (!g) return
    const r = RING * t
    g.position.set(Math.cos(a) * r, Math.sin(a) * r + Math.sin(state.clock.elapsedTime * 1.3 + i) * 0.08, 0.3)
    g.scale.setScalar(0.001 + t)
    g.visible = t > 0.01
    if (label.current) {
      label.current.style.opacity = String(t * (1 - ease(story.progress.roles, 0.0, 0.25)))
      label.current.style.display = t < 0.02 ? 'none' : 'flex'
    }
  })
  return (
    <group ref={ref} visible={false}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.22, 48]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.3} fog={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]}>
        <cylinderGeometry args={[0.95, 0.95, 0.2, 48]} />
        <meshStandardMaterial color="#5C9A35" roughness={0.4} fog={false} />
      </mesh>
      <Html center position={[0, 0, 0.2]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={label} className="flex flex-col items-center" style={{ display: 'none' }}>
          <Icon size={22} className="text-green-700" aria-hidden />
          <span className="mt-6 whitespace-nowrap rounded-md bg-white/95 px-2 py-0.5 font-heading text-[11px] font-bold text-navy-900 shadow">
            {title}
          </span>
        </div>
      </Html>
    </group>
  )
}

export default function Emblem() {
  const leaf = useLeafGeometry()
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const leafMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#5C9A35', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, fog: false }),
    [],
  )
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, fog: false }), [])

  useFrame((state) => {
    const show = ease(story.progress.pillars, 0.0, 0.15) * (1 - ease(story.progress.finale, 0.0, 0.2))
    const g = group.current
    if (g) {
      g.visible = show > 0.001
      g.position.set(EMBLEM_CENTER.x, EMBLEM_CENTER.y - (1 - show) * 4, EMBLEM_CENTER.z)
      g.scale.setScalar(0.001 + show)
    }
    if (spin.current) {
      // one full turn while it appears, then a gentle sway
      const turn = (1 - ease(story.progress.pillars, 0.0, 0.3)) * Math.PI * 2
      spin.current.rotation.y = turn + Math.sin(state.clock.elapsedTime * 0.7) * 0.25
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={spin}>
        <mesh geometry={leaf} material={leafMat} />
        {/* the "E" on the leaf */}
        <RoundedBox args={[0.32, 2.6, 0.2]} radius={0.08} position={[-0.75, -0.05, 0.42]} material={white} />
        {[0.95, -0.05, -1.05].map((y, i) => (
          <RoundedBox key={y} args={[i === 1 ? 1.25 : 1.6, 0.3, 0.2]} radius={0.08} position={[(i === 1 ? 1.25 : 1.6) / 2 - 0.85, y, 0.42]} material={white} />
        ))}
      </group>
      {PILLARS.map((p, i) => (
        <Token key={p.title} i={i} title={p.title} Icon={p.icon} />
      ))}
    </group>
  )
}
