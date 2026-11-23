import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { haversineKm } from '../lib/geo'
import { ease, story } from './store'

/*
 * 3D corridor map: a floating diorama of the Chennai - Krishnagiri - Salem - Namakkal corridor,
 * high above the highway. Towns and garages are at their real relative positions (lat/lon),
 * the hills are stylised bumps where the real hill ranges are. Truck pins move along NH 48 / NH 44;
 * one turns amber and the route to the nearest demo garage draws in.
 */

/** Where the map floats in the scene (the camera flies up to it). */
export const MAP_CENTER = new THREE.Vector3(4, 55, -30)

const LAT0 = 12.15
const LON0 = 79.1
const K = 14 // scene units per degree

/** lat/lon -> local map x/z (east = +x, north = -z). */
export function mapXZ(lat: number, lon: number): [number, number] {
  return [(lon - LON0) * K * Math.cos((LAT0 * Math.PI) / 180), -(lat - LAT0) * K]
}

const TOWNS: { name: string; lat: number; lon: number; big?: boolean }[] = [
  { name: 'Chennai', lat: 13.08, lon: 80.27, big: true },
  { name: 'Vellore', lat: 12.92, lon: 79.13 },
  { name: 'Krishnagiri', lat: 12.52, lon: 78.22, big: true },
  { name: 'Dharmapuri', lat: 12.13, lon: 78.16 },
  { name: 'Salem', lat: 11.66, lon: 78.15, big: true },
  { name: 'Namakkal', lat: 11.22, lon: 78.17, big: true },
]

/** The highway, town to town (NH 48 to Krishnagiri, then NH 44 south). */
const ROUTE: [number, number][] = [
  [13.08, 80.27],
  [12.97, 79.94],
  [12.92, 79.13],
  [12.68, 78.62],
  [12.52, 78.22],
  [12.13, 78.16],
  [11.95, 78.13],
  [11.66, 78.15],
  [11.45, 78.18],
  [11.22, 78.17],
]

/** Demo garages (same positions as the app's demo data, "Sample Tyre Works 1-13"). */
const GARAGES: [number, number][] = [
  [13.0475, 80.096],
  [12.961, 79.955],
  [12.93, 79.64],
  [12.923, 79.333],
  [12.92, 79.14],
  [12.79, 78.716],
  [12.64, 78.49],
  [12.52, 78.22],
  [12.13, 78.16],
  [11.95, 78.13],
  [11.67, 78.14],
  [11.45, 78.18],
  [11.22, 78.17],
]

/** Stylised hill ranges: [lat, lon, height, spread in degrees]. */
const HILLS: [number, number, number, number][] = [
  [11.8, 78.22, 3.2, 0.16], // Shevaroys (Yercaud)
  [11.3, 78.36, 2.8, 0.13], // Kolli hills
  [12.6, 78.85, 2.4, 0.2], // Javadhu hills
  [12.35, 77.95, 2.0, 0.22], // Melagiri
  [11.95, 78.55, 1.6, 0.18], // Kalrayan
  [12.75, 78.4, 1.2, 0.15],
]

const W = 50
const D = 40

function heightAt(x: number, z: number): number {
  let h = 0
  for (const [lat, lon, hh, s] of HILLS) {
    const [hx, hz] = mapXZ(lat, lon)
    const r = s * K
    const d2 = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r)
    h += hh * Math.exp(-d2)
  }
  // gentle rolling ground
  h += Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.12 + Math.sin(x * 0.9 + z * 0.7) * 0.05
  // keep the land above the base slab
  return h + 0.22
}

function useTerrain() {
  return useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, 160, 128)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const colors: number[] = []
    const low = new THREE.Color('#9fb45a')
    const mid = new THREE.Color('#c8a76a')
    const high = new THREE.Color('#8a6a4a')
    const sea = new THREE.Color('#7fb6c9')
    const [cx] = mapXZ(13.08, 80.27)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // Bay of Bengal east of Chennai's longitude (simple straight-ish coast)
      const coast = cx + 0.6 + (z + 6) * 0.08
      if (x > coast) {
        pos.setY(i, 0.06)
        colors.push(sea.r, sea.g, sea.b)
        continue
      }
      const h = heightAt(x, z)
      pos.setY(i, h)
      if (h < 0.6) c.copy(low).lerp(mid, h / 0.6)
      else c.copy(mid).lerp(high, Math.min(1, (h - 0.6) / 2))
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
}

const lineVertex = /* glsl */ `
  varying float vU;
  void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const lineFragment = /* glsl */ `
  uniform float uReveal; uniform vec3 uColor; uniform float uTime; uniform float uDash;
  varying float vU;
  void main() {
    if (vU > uReveal) discard;
    float dash = uDash > 0.5 ? step(0.45, fract(vU * 40.0 - uTime)) : 1.0;
    if (dash < 0.5) discard;
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }
`

function lineMaterial(color: string, dash = false) {
  return new THREE.ShaderMaterial({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    uniforms: {
      uReveal: { value: 1 },
      uTime: { value: 0 },
      uDash: { value: dash ? 1 : 0 },
      uColor: { value: new THREE.Color(color).convertSRGBToLinear() },
    },
  })
}

/** A map pin: a cone pointing down with a ball on top. */
function Pin({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.7, 16]} />
        <meshStandardMaterial fog={false} color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshStandardMaterial fog={false} color={color} roughness={0.35} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

export default function CorridorMap() {
  const terrain = useTerrain()
  const group = useRef<THREE.Group>(null)

  const route = useMemo(() => {
    const pts = ROUTE.map(([la, lo]) => {
      const [x, z] = mapXZ(la, lo)
      return new THREE.Vector3(x, heightAt(x, z) + 0.12, z)
    })
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3)
  }, [])
  const roadGeo = useMemo(() => new THREE.TubeGeometry(route, 300, 0.16, 8, false), [route])
  const roadMat = useMemo(() => lineMaterial('#f5c518'), [])

  // Truck pins: positions along the route (0..1); the amber one is the leaking truck
  const trucks = useRef<THREE.Group[]>([])
  const TRUCKS = useMemo(() => [0.08, 0.27, 0.5, 0.71, 0.9], [])
  const AMBER = 2 // index of the leaking truck
  const AMBER_AT = 0.43 // where it stops

  // Nearest demo garage to where the amber truck stops (straight-line, like the app)
  const amberPoint = useMemo(() => route.getPointAt(AMBER_AT), [route])
  const nearest = useMemo(() => {
    // map point -> lat/lon
    const lat = LAT0 - amberPoint.z / K
    const lon = LON0 + amberPoint.x / (K * Math.cos((LAT0 * Math.PI) / 180))
    let best = { i: 0, km: Infinity }
    GARAGES.forEach(([gl, go], i) => {
      const km = haversineKm(lat, lon, gl, go)
      if (km < best.km && km > 1) best = { i, km }
    })
    return best
  }, [amberPoint])
  const detour = useMemo(() => {
    const [gx, gz] = mapXZ(...GARAGES[nearest.i])
    const end = new THREE.Vector3(gx, heightAt(gx, gz) + 0.2, gz)
    const mid = amberPoint.clone().lerp(end, 0.5)
    mid.y += 1.6
    return new THREE.QuadraticBezierCurve3(amberPoint.clone().setY(amberPoint.y + 0.2), mid, end)
  }, [amberPoint, nearest])
  const detourGeo = useMemo(() => new THREE.TubeGeometry(detour, 80, 0.18, 8, false), [detour])
  const detourMat = useMemo(() => lineMaterial('#3E7231', true), [])
  const labelRef = useRef<HTMLDivElement>(null)
  const townLabels = useRef<HTMLSpanElement[]>([])

  useFrame((state) => {
    const p = story.progress.map
    const show = ease(p, 0.0, 0.18) * (1 - ease(story.progress.pillars, 0.0, 0.2))
    if (group.current) {
      group.current.visible = show > 0.001
      group.current.position.set(MAP_CENTER.x, MAP_CENTER.y - (1 - show) * 6, MAP_CENTER.z)
      group.current.scale.setScalar(0.6 + 0.4 * show)
    }
    const t = state.clock.elapsedTime
    roadMat.uniforms.uReveal.value = ease(p, 0.05, 0.35)
    // trucks drive along the route; the amber one stops at its point
    const move = ease(p, 0.2, 0.6)
    TRUCKS.forEach((start, i) => {
      const g = trucks.current[i]
      if (!g) return
      const u = i === AMBER ? start + (AMBER_AT - start) * move : (start + move * 0.12 + t * 0.004) % 1
      const pt = route.getPointAt(Math.min(0.999, Math.max(0, u)))
      g.position.copy(pt)
      g.position.y += 0.1 + (i === AMBER ? Math.abs(Math.sin(t * 3)) * 0.25 * ease(p, 0.5, 0.6) : 0)
      g.visible = ease(p, 0.15, 0.25) > 0.01
    })
    detourMat.uniforms.uReveal.value = ease(p, 0.58, 0.85)
    detourMat.uniforms.uTime.value = t * 0.6
    townLabels.current.forEach((el) => {
      el.style.opacity = String(ease(p, 0.1, 0.25) * show)
      el.style.display = show < 0.02 ? 'none' : 'inline-block'
    })
    if (labelRef.current) {
      const a = ease(p, 0.8, 0.9) * show
      labelRef.current.style.opacity = String(a)
      labelRef.current.style.display = a < 0.01 ? 'none' : 'block'
    }
  })

  const [gx, gz] = mapXZ(...GARAGES[nearest.i])

  return (
    <group ref={group} position={MAP_CENTER.toArray()} visible={false}>
      {/* diorama base */}
      <mesh position={[0, -0.9, 0]}>
        <boxGeometry args={[W + 0.6, 1.6, D + 0.6]} />
        <meshStandardMaterial color="#F4F1E8" roughness={0.8} fog={false} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[W + 0.7, 0.12, D + 0.7]} />
        <meshStandardMaterial color="#5C9A35" roughness={0.6} fog={false} />
      </mesh>
      <mesh geometry={terrain} >
        <meshStandardMaterial vertexColors roughness={0.95} flatShading fog={false} />
      </mesh>

      {/* highway */}
      <mesh geometry={roadGeo} material={roadMat} />

      {/* towns */}
      {TOWNS.map((tw) => {
        const [x, z] = mapXZ(tw.lat, tw.lon)
        const y = heightAt(x, z)
        return (
          <group key={tw.name} position={[x, y, z]}>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[tw.big ? 0.45 : 0.3, tw.big ? 0.45 : 0.3, 0.3, 20]} />
              <meshStandardMaterial fog={false} color="#0B1E36" />
            </mesh>
            <Html position={[0, 0.9, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <span
                ref={(el) => el && (townLabels.current[TOWNS.indexOf(tw)] = el)}
                className={`whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 font-heading font-bold text-navy-900 shadow ${
                  tw.big ? 'text-[11px]' : 'text-[10px]'
                }`}
              >
                {tw.name}
              </span>
            </Html>
          </group>
        )
      })}

      {/* garages (green) */}
      {GARAGES.map(([la, lo], i) => {
        const [x, z] = mapXZ(la, lo)
        return (
          <group key={i} position={[x + 0.5, heightAt(x + 0.5, z + 0.4), z + 0.4]}>
            <Pin color={i === nearest.i ? '#3E7231' : '#5C9A35'} scale={i === nearest.i ? 2.2 : 1.4} />
          </group>
        )
      })}

      {/* trucks */}
      {TRUCKS.map((_, i) => (
        <group key={i} ref={(g) => g && (trucks.current[i] = g)} scale={i === AMBER ? 2.2 : 1.6}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[0.9, 0.55, 0.55]} />
            <meshStandardMaterial fog={false}
              color={i === AMBER ? '#E0A100' : '#ffffff'}
              emissive={i === AMBER ? '#E0A100' : '#000000'}
              emissiveIntensity={i === AMBER ? 0.5 : 0}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0.5, 0.3, 0]}>
            <boxGeometry args={[0.3, 0.45, 0.5]} />
            <meshStandardMaterial fog={false} color="#0B1E36" />
          </mesh>
        </group>
      ))}

      {/* route to the nearest garage */}
      <mesh geometry={detourGeo} material={detourMat} />
      <Html position={[gx + 0.5, heightAt(gx, gz) + 2.6, gz + 0.4]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={labelRef} className="whitespace-nowrap rounded-lg bg-green-700 px-2.5 py-1.5 font-sans text-xs font-semibold text-white shadow-lg" style={{ display: 'none' }}>
          Nearest open garage · {nearest.km.toFixed(1)} km
        </div>
      </Html>
    </group>
  )
}
