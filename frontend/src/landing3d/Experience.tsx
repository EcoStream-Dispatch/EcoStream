import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import World from './World'
import Truck from './Truck'
import Wordmark from './Wordmark'
import { ease, lerp, story } from './store'

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

function CameraRig() {
  const { camera, size } = useThree()
  const look = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const smoothPointer = useRef({ x: 0, y: 0 })

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3)
    smoothPointer.current.x += (story.pointer.x - smoothPointer.current.x) * k
    smoothPointer.current.y += (story.pointer.y - smoothPointer.current.y) * k

    const t = ease(story.progress.hero, 0.05, 0.95)
    const portrait = size.width / size.height < 0.8
    const a = portrait ? HERO_START_P : HERO_START
    const b = portrait ? HERO_END_P : HERO_END
    const px = lerp(a.pos[0], b.pos[0], t)
    const py = lerp(a.pos[1], b.pos[1], t)
    const pz = lerp(a.pos[2], b.pos[2], t)

    target.set(px + smoothPointer.current.x * 0.8, py + smoothPointer.current.y * 0.35, pz)
    camera.position.lerp(target, Math.min(1, dt * 4))
    look.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t))
    camera.lookAt(look)
  })
  return null
}

/** The truck drives in from the distance when the page opens, then keeps rolling in place. */
function DrivingTruck({ startAt }: { startAt: number | null }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = startAt === null ? 0 : Math.min(1, (state.clock.elapsedTime - startAt) / 3.2)
    const e = 1 - Math.pow(1 - t, 3)
    ref.current.position.z = lerp(-34, 0, e)
  })
  return (
    <group ref={ref} position={[0, 0, -34]}>
      <Truck speed={DRIVE_SPEED / 0.56} />
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
        <World speed={DRIVE_SPEED} />
        <DrivingTruck startAt={startAt} />
        <Wordmark startAt={startAt} />
        <CameraRig />
        <ReadySignal onReady={onReady} />
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
