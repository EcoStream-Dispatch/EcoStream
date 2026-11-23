import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

/*
 * A stylised generic Indian cargo truck, built from three.js primitives (no model files).
 * 6 wheels: single front axle, dual rear axle (like the spec's 6W layout).
 * Front of the truck points to +z. Ground is y = 0. Units are roughly metres.
 *
 * `materials` is exposed so later scenes (X-ray) can fade the body to glass.
 */

export const WHEEL_R = 0.56
export const FRONT_AXLE_Z = 2.05
export const REAR_AXLE_Z = -2.55

/** Tyre positions, same names as the app (lib/tyreLayout.ts). */
export const TYRES: { id: string; x: number; z: number }[] = [
  { id: 'FL', x: 1.08, z: FRONT_AXLE_Z },
  { id: 'FR', x: -1.08, z: FRONT_AXLE_Z },
  { id: 'RL-O', x: 1.3, z: REAR_AXLE_Z },
  { id: 'RL-I', x: 0.92, z: REAR_AXLE_Z },
  { id: 'RR-I', x: -0.92, z: REAR_AXLE_Z },
  { id: 'RR-O', x: -1.3, z: REAR_AXLE_Z },
]

export function useTruckMaterials() {
  return useMemo(
    () => ({
      cab: new THREE.MeshPhysicalMaterial({ color: '#F7F5EE', metalness: 0.15, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
      cabLower: new THREE.MeshPhysicalMaterial({ color: '#0B1E36', metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 }),
      stripe: new THREE.MeshPhysicalMaterial({ color: '#5C9A35', metalness: 0.2, roughness: 0.35, clearcoat: 0.8 }),
      body: new THREE.MeshPhysicalMaterial({ color: '#3E7231', metalness: 0.15, roughness: 0.45, clearcoat: 0.6 }),
      bodyRib: new THREE.MeshStandardMaterial({ color: '#EDE8DA', roughness: 0.5 }),
      tarp: new THREE.MeshStandardMaterial({ color: '#0B1E36', roughness: 0.8 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#2a4058', metalness: 0.6, roughness: 0.08, clearcoat: 1 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: 0.22 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1a1f24', metalness: 0.4, roughness: 0.6 }),
      chassis: new THREE.MeshStandardMaterial({ color: '#22272d', metalness: 0.5, roughness: 0.55 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.92 }),
      rim: new THREE.MeshStandardMaterial({ color: '#c7ccd2', metalness: 0.85, roughness: 0.3 }),
      head: new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe7b0', emissiveIntensity: 1.6 }),
      amber: new THREE.MeshStandardMaterial({ color: '#ffb000', emissive: '#ff9a00', emissiveIntensity: 1.2 }),
      tail: new THREE.MeshStandardMaterial({ color: '#d32020', emissive: '#b00000', emissiveIntensity: 0.9 }),
    }),
    [],
  )
}
export type TruckMaterials = ReturnType<typeof useTruckMaterials>

/** Yellow Indian commercial number plate, drawn on a small canvas (no font downloads). */
function usePlateTexture(text: string) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#f5c518'
    g.fillRect(0, 0, 512, 128)
    g.strokeStyle = '#111'
    g.lineWidth = 8
    g.strokeRect(6, 6, 500, 116)
    g.fillStyle = '#111'
    g.font = 'bold 72px Arial, Helvetica, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 68)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [text])
}

/** Tyre cross-section revolved into a solid (rounded shoulders), axis along x. */
function useTyreGeometry() {
  return useMemo(() => {
    const R = WHEEL_R
    const r = 0.34
    const w = 0.17
    const pts: THREE.Vector2[] = []
    const shoulder = 0.07
    // inner bead -> sidewall -> rounded shoulder -> tread -> other side
    pts.push(new THREE.Vector2(r, -w))
    pts.push(new THREE.Vector2(R - shoulder, -w))
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2)
      pts.push(new THREE.Vector2(R - shoulder + Math.cos(a) * shoulder, -w + shoulder + Math.sin(a) * shoulder))
    }
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2)
      pts.push(new THREE.Vector2(R - shoulder + Math.cos(a) * shoulder, w - shoulder + Math.sin(a) * shoulder))
    }
    pts.push(new THREE.Vector2(r, w))
    const g = new THREE.LatheGeometry(pts, 56)
    g.rotateZ(Math.PI / 2)
    g.computeVertexNormals()
    return g
  }, [])
}

interface WheelProps {
  x: number
  z: number
  m: TruckMaterials
  tyreGeo: THREE.BufferGeometry
  /** Wheel spin angle ref (shared so all wheels turn together) */
  spin: React.MutableRefObject<number>
  /** Outer side of the truck (+1 left / -1 right), so the hub faces outwards */
  side: number
  /** Optional per-tyre material override (scenes colour tyres by status) */
  tyreMaterial?: THREE.Material
}

function Wheel({ x, z, m, tyreGeo, spin, side, tyreMaterial }: WheelProps) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = spin.current
  })
  const lugs = useMemo(() => Array.from({ length: 30 }, (_, i) => (i / 30) * Math.PI * 2), [])
  return (
    <group position={[x, WHEEL_R, z]}>
      <group ref={ref}>
        <mesh geometry={tyreGeo} material={tyreMaterial ?? m.rubber} castShadow receiveShadow />
        {/* tread blocks */}
        {lugs.map((a, i) => (
          <mesh
            key={i}
            position={[i % 2 ? 0.07 : -0.07, Math.cos(a) * (WHEEL_R + 0.005), Math.sin(a) * (WHEEL_R + 0.005)]}
            rotation={[a, 0, 0]}
            material={tyreMaterial ?? m.rubber}
          >
            <boxGeometry args={[0.13, 0.03, 0.06]} />
          </mesh>
        ))}
        {/* rim + hub on the outer face */}
        <mesh position={[side * 0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.rim} castShadow>
          <cylinderGeometry args={[0.33, 0.33, 0.06, 32]} />
        </mesh>
        <mesh position={[side * 0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.chrome}>
          <cylinderGeometry args={[0.13, 0.16, 0.06, 24]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[side * 0.17, Math.cos(a) * 0.22, Math.sin(a) * 0.22]} rotation={[0, 0, Math.PI / 2]} material={m.chrome}>
              <cylinderGeometry args={[0.025, 0.025, 0.05, 8]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

interface TruckProps {
  /** Wheel speed in radians per second (0 = parked) */
  speed?: number
  materials?: TruckMaterials
  /** Per-tyre material overrides, keyed by tyre id */
  tyreMaterials?: Partial<Record<string, THREE.Material>>
  /** Render extra things attached to the truck (sensor dots etc.) */
  children?: React.ReactNode
}

export default function Truck({ speed = 8, materials, tyreMaterials, children }: TruckProps) {
  const own = useTruckMaterials()
  const m = materials ?? own
  const tyreGeo = useTyreGeometry()
  const plate = usePlateTexture('TN 99 ZZ 0001')
  const spin = useRef(0)
  const body = useRef<THREE.Group>(null)

  useFrame((state, dt) => {
    spin.current += speed * Math.min(dt, 0.05)
    // A little suspension bounce while driving
    if (body.current) {
      const t = state.clock.elapsedTime
      body.current.position.y = speed > 0 ? Math.sin(t * 9) * 0.012 + Math.sin(t * 2.3) * 0.008 : 0
      body.current.rotation.z = speed > 0 ? Math.sin(t * 1.7) * 0.004 : 0
    }
  })

  const ribs = useMemo(() => Array.from({ length: 9 }, (_, i) => -4.15 + i * 0.62), [])

  return (
    <group>
      {/* ---------- Chassis (doesn't bounce) ---------- */}
      {[0.55, -0.55].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.7]} material={m.chassis} castShadow>
          <boxGeometry args={[0.16, 0.24, 7.6]} />
        </mesh>
      ))}
      {/* axles */}
      {[FRONT_AXLE_Z, REAR_AXLE_Z].map((z) => (
        <mesh key={z} position={[0, WHEEL_R, z]} rotation={[0, 0, Math.PI / 2]} material={m.chassis}>
          <cylinderGeometry args={[0.07, 0.07, 2.4, 12]} />
        </mesh>
      ))}

      {TYRES.map((t) => (
        <Wheel
          key={t.id}
          x={t.x}
          z={t.z}
          m={m}
          tyreGeo={tyreGeo}
          spin={spin}
          side={t.x > 0 ? 1 : -1}
          tyreMaterial={tyreMaterials?.[t.id]}
        />
      ))}

      <group ref={body}>
        {/* ---------- Cab ---------- */}
        <group position={[0, 0, 2.3]}>
          <RoundedBox args={[2.42, 2.25, 2.1]} radius={0.16} smoothness={4} position={[0, 2.12, 0]} material={m.cab} castShadow receiveShadow />
          {/* roof visor */}
          <RoundedBox args={[2.46, 0.22, 0.5]} radius={0.08} position={[0, 3.2, 0.95]} material={m.cab} castShadow />
          {/* navy lower panel + green stripe around the cab */}
          <RoundedBox args={[2.44, 0.6, 2.12]} radius={0.12} smoothness={4} position={[0, 1.3, 0]} material={m.cabLower} castShadow />
          <mesh position={[0, 1.55, 0]} material={m.stripe}>
            <boxGeometry args={[2.44, 0.14, 2.12]} />
          </mesh>

          {/* windscreen (two panes) */}
          {[-0.56, 0.56].map((x) => (
            <mesh key={x} position={[x, 2.62, 1.056]} rotation={[-0.06, 0, 0]} material={m.glass}>
              <planeGeometry args={[1.04, 0.95]} />
            </mesh>
          ))}
          {/* door outline + handle */}
          {[1.214, -1.214].map((x) => (
            <group key={x} position={[x, 0, 0.15]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
              {[
                [0, 3.04, 1.36, 0.025],
                [0, 1.16, 1.36, 0.025],
                [-0.67, 2.1, 0.025, 1.9],
                [0.67, 2.1, 0.025, 1.9],
              ].map(([px, py, w, h], i) => (
                <mesh key={i} position={[px, py, 0.002]}>
                  <planeGeometry args={[w, h]} />
                  <meshStandardMaterial color="#b8b2a2" />
                </mesh>
              ))}
              <mesh position={[0.45, 2.05, 0.01]} material={m.chrome}>
                <boxGeometry args={[0.22, 0.05, 0.03]} />
              </mesh>
            </group>
          ))}
          {/* roof marker lights */}
          {[-0.8, -0.4, 0, 0.4, 0.8].map((x) => (
            <mesh key={x} position={[x, 3.33, 1.12]} material={m.amber}>
              <boxGeometry args={[0.12, 0.05, 0.05]} />
            </mesh>
          ))}
          {/* side windows */}
          {[1.212, -1.212].map((x) => (
            <mesh key={x} position={[x, 2.6, 0.35]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} material={m.glass}>
              <planeGeometry args={[1.0, 0.8]} />
            </mesh>
          ))}
          {/* grille */}
          <mesh position={[0, 1.78, 1.06]} material={m.dark}>
            <boxGeometry args={[1.3, 0.42, 0.04]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 1.63 + i * 0.1, 1.085]} material={m.chrome}>
              <boxGeometry args={[1.26, 0.025, 0.02]} />
            </mesh>
          ))}
          {/* headlights + indicators */}
          {[0.88, -0.88].map((x) => (
            <group key={x}>
              <RoundedBox args={[0.42, 0.22, 0.06]} radius={0.05} position={[x, 1.78, 1.07]} material={m.head} />
              <RoundedBox args={[0.16, 0.12, 0.05]} radius={0.03} position={[x + (x > 0 ? 0.04 : -0.04), 1.55, 1.07]} material={m.amber} />
            </group>
          ))}
          {/* bumper */}
          <RoundedBox args={[2.5, 0.32, 0.34]} radius={0.08} position={[0, 1.08, 1.0]} material={m.chrome} castShadow />
          {/* number plate */}
          <mesh position={[0, 1.08, 1.18]}>
            <planeGeometry args={[0.78, 0.2]} />
            <meshStandardMaterial map={plate} roughness={0.5} />
          </mesh>
          {/* mirrors */}
          {[1, -1].map((s) => (
            <group key={s} position={[s * 1.35, 2.55, 0.8]}>
              <mesh position={[-s * 0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.dark}>
                <cylinderGeometry args={[0.02, 0.02, 0.22, 6]} />
              </mesh>
              <RoundedBox args={[0.08, 0.42, 0.2]} radius={0.03} position={[s * 0.05, 0, 0]} material={m.dark} />
            </group>
          ))}
          {/* step */}
          {[1.18, -1.18].map((x) => (
            <mesh key={x} position={[x, 0.95, 0.4]} material={m.chrome}>
              <boxGeometry args={[0.12, 0.05, 0.5]} />
            </mesh>
          ))}
        </group>

        {/* ---------- Cargo body ---------- */}
        <group position={[0, 0, -1.6]}>
          {/* floor */}
          <mesh position={[0, 1.08, 0]} material={m.chassis} castShadow>
            <boxGeometry args={[2.52, 0.14, 5.4]} />
          </mesh>
          {/* high sides */}
          <RoundedBox args={[2.52, 1.75, 5.4]} radius={0.05} position={[0, 2.03, 0]} material={m.body} castShadow receiveShadow />
          {/* vertical ribs */}
          {ribs.map((z) =>
            [1.275, -1.275].map((x) => (
              <mesh key={`${x}${z}`} position={[x, 2.03, z + 1.6 - 0.05]} material={m.bodyRib}>
                <boxGeometry args={[0.04, 1.7, 0.07]} />
              </mesh>
            )),
          )}
          {/* cream band */}
          {[1.28, -1.28].map((x) => (
            <mesh key={x} position={[x, 1.4, 0]} material={m.bodyRib}>
              <boxGeometry args={[0.02, 0.16, 5.38]} />
            </mesh>
          ))}
          {/* tarp top */}
          <mesh position={[0, 2.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.32]} material={m.tarp} castShadow>
            <cylinderGeometry args={[1.26, 1.26, 5.36, 32, 1, false, Math.PI / 2, Math.PI]} />
          </mesh>
          {/* rear tail lights */}
          {[1.0, -1.0].map((x) => (
            <RoundedBox key={x} args={[0.3, 0.14, 0.05]} radius={0.03} position={[x, 1.25, -2.72]} material={m.tail} />
          ))}
        </group>

        {/* fuel tank + battery box */}
        <mesh position={[1.0, 0.95, 0.6]} rotation={[Math.PI / 2, 0, 0]} material={m.chrome} castShadow>
          <cylinderGeometry args={[0.26, 0.26, 1.1, 24]} />
        </mesh>
        <mesh position={[-1.0, 0.92, 0.6]} material={m.dark} castShadow>
          <boxGeometry args={[0.42, 0.4, 0.8]} />
        </mesh>

        {/* mudguards over the wheels */}
        {[
          { z: FRONT_AXLE_Z, x: 1.08, w: 0.42 },
          { z: FRONT_AXLE_Z, x: -1.08, w: 0.42 },
          { z: REAR_AXLE_Z, x: 1.11, w: 0.8 },
          { z: REAR_AXLE_Z, x: -1.11, w: 0.8 },
        ].map((g, i) => (
          <mesh key={i} position={[g.x, WHEEL_R, g.z]} rotation={[0, 0, Math.PI / 2]} material={m.dark} castShadow>
            <cylinderGeometry args={[WHEEL_R + 0.1, WHEEL_R + 0.1, g.w, 24, 1, true, Math.PI * 0.05, Math.PI * 0.9]} />
          </mesh>
        ))}
        {/* mud flaps */}
        {[1.1, -1.1].map((x) => (
          <mesh key={x} position={[x, 0.45, REAR_AXLE_Z - 0.75]} material={m.dark}>
            <boxGeometry args={[0.7, 0.6, 0.02]} />
          </mesh>
        ))}

        {children}
      </group>
    </group>
  )
}
