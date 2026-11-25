import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ease, story, type SectionId } from '../landing3d/store'
import NightWorld from './NightWorld'
import TruckRig from './TruckRig'
import { Garage, HotLeakStands, JourneyStream, MapBoard, MAP_Y } from './Chapters'
import { quality } from './state'

/*
 * The night story's canvas: world, truck, chapter scenes, scroll-driven camera, post effects.
 */

type V3 = [number, number, number]
interface Key {
  pos: V3
  look: V3
}

const START: Key = { pos: [8.6, 1.3, -13.8], look: [4.2, 1.8, -1.8] }
/** Where the camera lands in each chapter (landscape). The caption card sits bottom-left. */
const KEYS: { id: SectionId; key: Key; port?: Key }[] = [
  { id: 'hero', key: { pos: [11, 2.6, -5.0], look: [1.6, 1.5, -3.6] }, port: { pos: [14.5, 3.8, -8], look: [0, -0.6, 0.5] } },
  { id: 'xray', key: { pos: [8.2, 7.2, 7.2], look: [-0.6, 0.6, -0.4] }, port: { pos: [11, 13, 12], look: [0, 0.2, 0] } },
  { id: 'leak', key: { pos: [-5.2, 1.4, 5.6], look: [-0.9, 0.75, 1.3] }, port: { pos: [-8, 2.8, 8.8], look: [-1, -0.4, 1.4] } },
  { id: 'hotleak', key: { pos: [9.6, 2.4, -6.2], look: [0.0, 0.8, -10.4] }, port: { pos: [16.5, 5, -9.2], look: [0, -1.2, -9.2] } },
  { id: 'journey', key: { pos: [-9.5, 9.5, 12], look: [5.5, 9, -24] }, port: { pos: [-14, 14, 20], look: [5, 7, -24] } },
  { id: 'map', key: { pos: [-8, MAP_Y + 62, 26], look: [-6, MAP_Y, -4.5] }, port: { pos: [0, MAP_Y + 150, 16], look: [0, MAP_Y, 4] } },
  { id: 'finale', key: { pos: [8.8, 3.0, -2.5], look: [-1.2, 1.7, -16.5] }, port: { pos: [12, 5, -1], look: [0, -0.5, -18] } },
]

/** Journey: first a close look at the cab and its sealed unit, then pull back along the stream. */
const JOURNEY_CAB: Key = { pos: [3.4, 3.1, -7.4], look: [0.3, 2.1, -3.8] }

function CameraRig() {
  const { camera, size } = useThree()
  const look = useMemo(() => new THREE.Vector3(...START.look), [])
  const sp = useRef({ x: 0, y: 0 })
  const p = useMemo(() => new THREE.Vector3(), [])
  const l = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const portrait = size.width / size.height < 0.8
    sp.current.x += (story.pointer.x - sp.current.x) * Math.min(1, dt * 2)
    sp.current.y += (story.pointer.y - sp.current.y) * Math.min(1, dt * 2)
    p.set(...START.pos)
    l.set(...START.look)
    if (portrait) {
      p.set(11, 2.4, -17)
      l.set(-0.3, -0.4, -1.5)
    }
    for (const k of KEYS) {
      const pr = story.progress[k.id]
      if (k.id === 'journey') {
        const a = ease(pr, 0, 0.3)
        if (a > 0) {
          p.lerp(new THREE.Vector3(...JOURNEY_CAB.pos), a)
          l.lerp(new THREE.Vector3(...JOURNEY_CAB.look), a)
        }
        const b = ease(pr, 0.4, 0.85)
        if (b > 0) {
          const kk = portrait && k.port ? k.port : k.key
          p.lerp(new THREE.Vector3(...kk.pos), b)
          l.lerp(new THREE.Vector3(...kk.look), b)
        }
        continue
      }
      const t = k.id === 'hero' ? ease(pr, 0.05, 0.95) : ease(pr, 0, 0.5)
      if (t <= 0) continue
      const kk = portrait && k.port ? k.port : k.key
      p.lerp(new THREE.Vector3(...kk.pos), t)
      l.lerp(new THREE.Vector3(...kk.look), t)
    }
    // slow breathing drift + pointer parallax, so the frame is never dead still
    const tt = performance.now() / 1000
    p.x += Math.sin(tt * 0.15) * 0.12 + sp.current.x * 0.35
    p.y += Math.sin(tt * 0.11) * 0.05 + sp.current.y * 0.15
    camera.position.lerp(p, Math.min(1, dt * 3))
    look.lerp(l, Math.min(1, dt * 3.5))
    camera.lookAt(look)
  })
  return null
}

/** Warm key from the lamp side, aimed at the truck: the light that makes it read at night. */
function KeyLight() {
  const l = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    if (l.current) l.current.target = target
  }, [target])
  return (
    <>
      <spotLight
        ref={l}
        position={[8, 7, -10]}
        color="#ffc58a"
        intensity={quality.low ? 260 : 380}
        distance={40}
        angle={0.45}
        penumbra={1}
        decay={2}
        castShadow={!quality.low}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
      />
      <primitive object={target} position={[0, 1.4, -1.5]} />
    </>
  )
}

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.22
    return () => {
      scene.environment = null
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  return null
}

function Ready({ onReady }: { onReady: () => void }) {
  const n = useRef(0)
  const done = useRef(false)
  useFrame(() => {
    if (!done.current && ++n.current > 4) {
      done.current = true
      onReady()
    }
  })
  return null
}

export default function Scene({ paused, onReady, truckUrl, wheelUrl }: { paused: boolean; onReady: () => void; truckUrl: string; wheelUrl: string }) {
  const low = quality.low
  return (
    <Canvas
      shadows={!low}
      frameloop={paused ? 'never' : 'always'}
      dpr={low ? [1, 1.25] : [1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      camera={{ fov: 38, near: 0.1, far: 900, position: START.pos }}
    >
      <color attach="background" args={['#04070b']} />
      <fogExp2 attach="fog" args={['#070b11', 0.018]} />
      <Env />
      <hemisphereLight args={['#2a3a55', '#0b0d0a', 0.55]} />
      {/* moonlight: cool, from behind-left, gives the rim on the truck */}
      <directionalLight position={[-30, 40, 30]} intensity={1.6} color="#9db8ff" />
      <KeyLight />
      {/* cool rim from behind the truck, separates it from the dark background */}
      <directionalLight position={[-12, 6, 25]} intensity={1.4} color="#7fa8ff" />
      <Suspense fallback={null}>
        <NightWorld />
        <TruckRig url={truckUrl} />
        <HotLeakStands wheelUrl={wheelUrl} />
        <JourneyStream />
        <MapBoard />
        <Garage />
        <Ready onReady={onReady} />
      </Suspense>
      <CameraRig />
      <AdaptiveDpr pixelated={false} />
      {low ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={1} intensity={0.6} />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={1.2} distanceFalloff={1.5} intensity={2.2} halfRes />
          <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.25} intensity={0.9} radius={0.75} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <SMAA />
          <Vignette offset={0.22} darkness={0.8} />
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.22} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
