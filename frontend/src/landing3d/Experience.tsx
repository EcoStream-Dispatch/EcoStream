import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import World from './World'
import Truck, { useTruckMaterials, type TruckMaterials } from './Truck'
import { Sensors, XrayController, useTyreMaterials } from './Xray'
import HotLeakScene from './HotLeak'
import JourneyScene, { CabUnit } from './Journey'
import CorridorMap from './CorridorMap'
import Wordmark from './Wordmark'
import { ease, lerp, story, type SectionId } from './store'

/*
 * The fixed 3D canvas behind the landing page.
 * The camera path is driven by scroll progress (story.progress) plus a little
 * pointer / tilt parallax. Each later phase adds its scene and camera keys here.
 */

const DRIVE_SPEED = 12 // m/s the world scrolls past

interface Key {
  pos: [number, number, number]
  look: [number, number, number]
}

/** Camera keys for the hero: front three-quarter, then sliding to the side (ready for the X-ray). */
const HERO_START: Key = { pos: [-5.6, 1.5, 12.5], look: [-1.6, 2.3, 0] }
const HERO_END: Key = { pos: [-10.5, 3.2, 0.6], look: [0, 1.7, -0.4] }
/** Portrait phones: further back and centred, truck between the wordmark and the text. */
const HERO_START_P: Key = { pos: [-7.5, 3.4, 19], look: [-0.4, 0.6, 0] }
const HERO_END_P: Key = { pos: [-27, 5.5, 0.2], look: [0, 1.4, -0.6] }

/**
 * Where the camera ends up in each story section (landscape, portrait).
 * Each section moves the camera from the previous key to its own during its first 55%.
 * Desktop keys keep the truck right of centre, because the text card is on the left.
 */
const KEYS: { id: SectionId; land: Key; port: Key }[] = [
  { id: 'hero', land: HERO_END, port: HERO_END_P },
  // X-ray: high three-quarter view, all six tyres visible
  { id: 'xray', land: { pos: [-9.8, 8.6, 10.8], look: [-2.9, 0.7, -1.0] }, port: { pos: [-12.5, 15, 15], look: [0.9, -2.2, -0.8] } },
  // Slow leak: close on the rear-left outer tyre (left side = +x)
  // (leak key below) then: hot vs leak podium beside the road, then the aerial signal journey
  { id: 'leak', land: { pos: [8.4, 2.4, -9.2], look: [2.9, 1.0, -0.6] }, port: { pos: [10.5, 5.2, -11.5], look: [1.3, -1.6, -2.55] } },
  { id: 'hotleak', land: { pos: [22, 4.8, 5.4], look: [7.2, 1.5, 5.6] }, port: { pos: [22, 10.5, 1.2], look: [7.2, -2.2, 1.2] } },
  { id: 'journey', land: { pos: [-25, 12.5, 27], look: [4.5, 8.5, -7] }, port: { pos: [-36, 32, 48], look: [6, 3, -12] } },
  // Corridor map: the camera flies up above the cloud to the floating map (MAP_CENTER in CorridorMap.tsx)
  { id: 'map', land: { pos: [-9, 96, 14], look: [-7.5, 52, -29] }, port: { pos: [2.5, 175, 38], look: [2.5, 38, -27] } },
]

function mixKey(out: { pos: THREE.Vector3; look: THREE.Vector3 }, k: Key, t: number) {
  out.pos.lerp(new THREE.Vector3(...k.pos), t)
  out.look.lerp(new THREE.Vector3(...k.look), t)
}

function CameraRig() {
  const { camera, size } = useThree()
  const look = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const smoothPointer = useRef({ x: 0, y: 0 })

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3)
    smoothPointer.current.x += (story.pointer.x - smoothPointer.current.x) * k
    smoothPointer.current.y += (story.pointer.y - smoothPointer.current.y) * k

    const portrait = size.width / size.height < 0.8
    const start = portrait ? HERO_START_P : HERO_START
    const cur = { pos: new THREE.Vector3(...start.pos), look: new THREE.Vector3(...start.look) }
    for (const k of KEYS) {
      const t = k.id === 'hero' ? ease(story.progress.hero, 0.05, 0.95) : ease(story.progress[k.id], 0, 0.55)
      if (t > 0) mixKey(cur, portrait ? k.port : k.land, t)
    }
    target.set(cur.pos.x + smoothPointer.current.x * 0.8, cur.pos.y + smoothPointer.current.y * 0.35, cur.pos.z)
    camera.position.lerp(target, Math.min(1, dt * 4))
    look.lerp(cur.look, Math.min(1, dt * 5))
    camera.lookAt(look)
  })
  return null
}

/** The truck drives in from the distance when the page opens, then keeps rolling in place. */
function DrivingTruck({
  startAt,
  materials,
  tyres,
}: {
  startAt: number | null
  materials: TruckMaterials
  tyres: Record<string, THREE.Material>
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = startAt === null ? 0 : Math.min(1, (state.clock.elapsedTime - startAt) / 3.2)
    const e = 1 - Math.pow(1 - t, 3)
    ref.current.position.z = lerp(-34, 0, e)
  })
  return (
    <group ref={ref} position={[0, 0, -34]}>
      <Truck speed={DRIVE_SPEED / 0.56} materials={materials} tyreMaterials={tyres} />
      <Sensors />
      <CabUnit />
    </group>
  )
}

/** Tells the page when the first frame has been drawn (to hide the loader). */
function ReadySignal({ onReady }: { onReady: (clockTime: number) => void }) {
  const done = useRef(false)
  const frames = useRef(0)
  useFrame((state) => {
    if (done.current) return
    // wait a few frames so shaders are compiled and the first image is on screen
    if (++frames.current > 3) {
      done.current = true
      onReady(state.clock.elapsedTime)
    }
  })
  return null
}

interface Props {
  startAt: number | null
  onReady: (t: number) => void
  /** Stop drawing frames (story scrolled out of view) */
  paused: boolean
}

/** Everything inside the canvas (hooks that need the R3F context live here). */
function Scene({ startAt, onReady }: Omit<Props, 'paused'>) {
  const materials = useTruckMaterials()
  const tyres = useTyreMaterials()
  return (
    <>
      <World speed={DRIVE_SPEED} />
      <DrivingTruck startAt={startAt} materials={materials} tyres={tyres} />
      <XrayController materials={materials} tyres={tyres} />
      <HotLeakScene />
      <JourneyScene />
      <CorridorMap />
      <Wordmark startAt={startAt} />
      <CameraRig />
      <ReadySignal onReady={onReady} />
    </>
  )
}

export default function Experience({ startAt, onReady, paused }: Props) {
  const low = story.lowPower
  return (
    <Canvas
      shadows
      frameloop={paused ? 'never' : 'always'}
      dpr={low ? [1, 1.5] : [1, 2]}
      // Desktop uses SMAA in the effect pass; phones skip effects and use the cheap built-in AA.
      gl={{ antialias: low, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 5000, position: HERO_START.pos }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.62
      }}
    >
      <Suspense fallback={null}>
        <Scene startAt={startAt} onReady={onReady} />
        <AdaptiveDpr pixelated={false} />
        {!low && (
          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom intensity={0.35} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
            <Vignette offset={0.3} darkness={0.42} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  )
}
