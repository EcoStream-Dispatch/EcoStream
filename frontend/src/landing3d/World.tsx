import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import type { Sky as SkyImpl } from 'three-stdlib'
import { dayFactor, driveFactor, story } from './store'

/*
 * Golden-hour South Indian highway, drawn in code: sky, warm sun, road with moving lane
 * marks, red-earth shoulders, fields, palms and round trees, electricity poles, far hills.
 * Everything except the sky moves towards +z, so the parked truck looks like it's driving.
 */

/** Direction the sun comes from (low, warm, to the left and a bit behind the truck). */
export const SUN_DIR = new THREE.Vector3(-0.78, 0.1, -0.6).normalize()
/** Morning sun for the finale: higher, in front of the truck and to the right. */
const MORNING_DIR = new THREE.Vector3(0.55, 0.42, -0.72).normalize()

const LOOP = 240 // metres of scenery that repeat
const START_Z = -200

/** Wrap z into the visible band, as the world scrolls past. */
const wrapZ = (z: number) => ((((z - START_Z) % LOOP) + LOOP) % LOOP) + START_Z

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Road texture: asphalt with a dashed centre line and solid edge lines. */
function useRoadTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#4a4a4f'
    g.fillRect(0, 0, 256, 512)
    // speckle
    const r = seeded(7)
    for (let i = 0; i < 2500; i++) {
      const v = 60 + Math.floor(r() * 40)
      g.fillStyle = `rgb(${v},${v},${v + 4})`
      g.fillRect(r() * 256, r() * 512, 1.5, 1.5)
    }
    g.fillStyle = '#f2efe6'
    g.fillRect(14, 0, 7, 512)
    g.fillRect(235, 0, 7, 512)
    g.fillStyle = '#f5c518'
    g.fillRect(124, 0, 8, 300)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, LOOP / 14)
    tex.anisotropy = 8
    return tex
  }, [])
}

interface Placed {
  x: number
  z: number
  s: number
  r: number
}

function useScatter(count: number, seed: number, minX: number, maxX: number) {
  return useMemo<Placed[]>(() => {
    const rnd = seeded(seed)
    return Array.from({ length: count }, () => {
      const side = rnd() > 0.5 ? 1 : -1
      return {
        x: side * (minX + rnd() * (maxX - minX)),
        z: START_Z + rnd() * LOOP,
        s: 0.75 + rnd() * 0.6,
        r: rnd() * Math.PI * 2,
      }
    })
  }, [count, seed, minX, maxX])
}

/** Instanced mesh whose instances move along z with the world. */
function Instanced({
  items,
  geometry,
  material,
  offset,
  y = 0,
  baseScale = [1, 1, 1],
  castShadow = false,
  hide,
}: {
  items: Placed[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  offset: React.MutableRefObject<number>
  y?: number
  baseScale?: [number, number, number]
  castShadow?: boolean
  /** Hide the whole group when this returns true (e.g. poles near the finale garage) */
  hide?: () => boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const update = () => {
    const mesh = ref.current
    if (!mesh) return
    mesh.visible = !hide?.()
    items.forEach((it, i) => {
      tmp.position.set(it.x, y * it.s, wrapZ(it.z + offset.current))
      tmp.rotation.set(0, it.r, 0)
      tmp.scale.set(baseScale[0] * it.s, baseScale[1] * it.s, baseScale[2] * it.s)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  useLayoutEffect(update)
  useFrame(update)
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} frustumCulled={false} />
}

export default function World({ speed = 12 }: { speed?: number }) {
  const road = useRoadTexture()
  const offset = useRef(0)

  // Shared geometries / materials
  const geo = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.12, 0.2, 6, 6)
    trunk.translate(0, 3, 0)
    const frond = new THREE.ConeGeometry(2.2, 1.4, 7, 1, true)
    frond.translate(0, 6.2, 0)
    const roundTrunk = new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6)
    roundTrunk.translate(0, 1.3, 0)
    const crown = new THREE.IcosahedronGeometry(2.4, 1)
    crown.translate(0, 4.2, 0)
    const pole = new THREE.CylinderGeometry(0.09, 0.12, 9, 6)
    pole.translate(0, 4.5, 0)
    const arm = new THREE.BoxGeometry(2.4, 0.12, 0.12)
    arm.translate(0, 8.4, 0)
    const shrub = new THREE.IcosahedronGeometry(0.9, 0)
    shrub.translate(0, 0.5, 0)
    return { trunk, frond, roundTrunk, crown, pole, arm, shrub }
  }, [])
  const mat = useMemo(
    () => ({
      trunk: new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.9 }),
      frond: new THREE.MeshStandardMaterial({ color: '#4f7a2a', roughness: 0.8, side: THREE.DoubleSide, flatShading: true }),
      crown: new THREE.MeshStandardMaterial({ color: '#5f8a33', roughness: 0.85, flatShading: true }),
      pole: new THREE.MeshStandardMaterial({ color: '#9a9690', roughness: 0.7 }),
      shrub: new THREE.MeshStandardMaterial({ color: '#7d9a3c', roughness: 0.9, flatShading: true }),
    }),
    [],
  )

  const palms = useScatter(46, 11, 12, 60)
  const trees = useScatter(40, 23, 14, 80)
  const shrubs = useScatter(70, 37, 11.5, 34)
  const poles = useMemo<Placed[]>(() => Array.from({ length: 12 }, (_, i) => ({ x: 8.5, z: START_Z + i * (LOOP / 12), s: 1, r: Math.PI / 2 })), [])

  // Far hills (static, they're far away so they barely move)
  const hills = useMemo(() => {
    const rnd = seeded(91)
    return Array.from({ length: 14 }, (_, i) => ({
      x: (i - 7) * 38 + rnd() * 20,
      z: -260 - rnd() * 80,
      sx: 40 + rnd() * 40,
      sy: 14 + rnd() * 22,
      sz: 30 + rnd() * 20,
    }))
  }, [])

  // drei's <Sky> is a three.js Sky (a Mesh with a ShaderMaterial)
  const sky = useRef<SkyImpl>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const fog = useRef<THREE.Fog>(null)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(
    () => ({ sunEve: new THREE.Color('#ffc27a'), sunDay: new THREE.Color('#fff1da'), fogEve: new THREE.Color('#f2c792'), fogDay: new THREE.Color('#e9eef0') }),
    [],
  )

  useFrame((_, dt) => {
    if (!story.visible) return
    const d = speed * driveFactor() * Math.min(dt, 0.05)
    offset.current += d
    road.offset.y += d / 14

    // Finale: the sun rises to a bright morning
    const day = dayFactor()
    dir.copy(SUN_DIR).lerp(MORNING_DIR, day).normalize()
    const mat = sky.current?.material as THREE.ShaderMaterial | undefined
    if (mat?.uniforms?.sunPosition) {
      mat.uniforms.sunPosition.value.copy(dir).multiplyScalar(100)
      mat.uniforms.rayleigh.value = 2.6 - day * 0.8
      mat.uniforms.turbidity.value = 9 - day * 2.5
      mat.uniforms.mieCoefficient.value = 0.007 - day * 0.004
    }
    if (sun.current) {
      sun.current.position.copy(dir).multiplyScalar(40)
      sun.current.color.copy(c.sunEve).lerp(c.sunDay, day)
      sun.current.intensity = 3.2 + day * 0.6
    }
    if (hemi.current) hemi.current.intensity = 1.25 + day * 0.35
    if (fog.current) {
      fog.current.color.copy(c.fogEve).lerp(c.fogDay, day)
      fog.current.far = 300 + day * 150
    }
  })

  return (
    <>
      <Sky
        ref={sky}
        distance={4500}
        sunPosition={SUN_DIR.clone().multiplyScalar(100).toArray()}
        turbidity={9}
        rayleigh={2.6}
        mieCoefficient={0.007}
        mieDirectionalG={0.88}
      />
      <fog ref={fog} attach="fog" args={['#f2c792', 45, 300]} />
      <hemisphereLight ref={hemi} args={['#ffe3b8', '#8a6a44', 1.25]} />
      <directionalLight
        ref={sun}
        position={SUN_DIR.clone().multiplyScalar(40).toArray()}
        intensity={3.2}
        color="#ffc27a"
        castShadow
        shadow-mapSize={[story.lowPower ? 1024 : 2048, story.lowPower ? 1024 : 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* soft fill from the camera side so the truck front isn't black */}
      <directionalLight position={[8, 6, 14]} intensity={1.4} color="#ffe9cc" />

      {/* Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, START_Z + LOOP / 2]} receiveShadow>
        <planeGeometry args={[7.4, LOOP]} />
        <meshStandardMaterial map={road} roughness={0.92} />
      </mesh>
      {/* Red-earth shoulders */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, START_Z + LOOP / 2]} receiveShadow>
        <planeGeometry args={[19, LOOP]} />
        <meshStandardMaterial color="#b9784a" roughness={1} />
      </mesh>
      {/* Fields */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -150]} receiveShadow>
        <planeGeometry args={[900, 700]} />
        <meshStandardMaterial color="#a8a24f" roughness={1} />
      </mesh>

      <Instanced items={palms} geometry={geo.trunk} material={mat.trunk} offset={offset} castShadow />
      <Instanced items={palms} geometry={geo.frond} material={mat.frond} offset={offset} castShadow />
      <Instanced items={trees} geometry={geo.roundTrunk} material={mat.trunk} offset={offset} castShadow />
      <Instanced items={trees} geometry={geo.crown} material={mat.crown} offset={offset} castShadow />
      <Instanced items={shrubs} geometry={geo.shrub} material={mat.shrub} offset={offset} baseScale={[0.6, 0.6, 0.6]} />
      {/* poles stand on the garage side of the road, so they step aside for the finale */}
      <Instanced items={poles} geometry={geo.pole} material={mat.pole} offset={offset} castShadow hide={() => dayFactor() > 0.35} />
      <Instanced items={poles} geometry={geo.arm} material={mat.pole} offset={offset} hide={() => dayFactor() > 0.35} />

      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, 0, h.z]} scale={[h.sx, h.sy, h.sz]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#b98a6a" roughness={1} flatShading />
        </mesh>
      ))}
    </>
  )
}
