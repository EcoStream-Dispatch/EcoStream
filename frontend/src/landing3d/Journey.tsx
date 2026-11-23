import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Billboard, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { REAR_AXLE_Z, WHEEL_R } from './Truck'
import { ease, story } from './store'
import { asset } from '../lib/asset'

/*
 * Signal journey: a stream of light from the tyre sensor -> the in-cab EcoStream unit
 * (a plain rounded box with the leaf logo) -> a 4G tower -> the cloud -> the owner's phone,
 * which shows an alert card in our app style.
 */

export const JOURNEY = {
  tyre: new THREE.Vector3(1.55, WHEEL_R, REAR_AXLE_Z),
  unit: new THREE.Vector3(0.45, 2.42, 3.05),
  tower: new THREE.Vector3(17, 15.5, -15),
  cloud: new THREE.Vector3(6, 22, -30),
  phone: new THREE.Vector3(11, 8.5, 4),
}


const streamVertex = /* glsl */ `
  varying float vU;
  void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const streamFragment = /* glsl */ `
  uniform float uReveal; uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
  varying float vU;
  void main() {
    if (vU > uReveal) discard;
    float pulse = 0.55 + 0.45 * sin((vU * 60.0 - uTime * 6.0));
    float head = smoothstep(uReveal - 0.04, uReveal, vU);
    vec3 col = mix(uColor, vec3(1.0), head * 0.8);
    gl_FragColor = vec4(col * (0.9 + pulse * 0.6), (0.55 + 0.45 * pulse) * uAlpha);
    #include <colorspace_fragment>
  }
`

function Stream({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 400, 0.07, 10, false), [curve])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: streamVertex,
        fragmentShader: streamFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uReveal: { value: 0 },
          uTime: { value: 0 },
          uAlpha: { value: 0 },
          uColor: { value: new THREE.Color('#8CC152').convertSRGBToLinear() },
        },
      }),
    [],
  )
  // Bright packets travelling along the revealed part
  const packets = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const N = 14
  useFrame((state) => {
    const p = story.progress.journey
    const reveal = ease(p, 0.08, 0.8)
    const alpha = ease(p, 0.02, 0.1) * (1 - ease(story.progress.map, 0.0, 0.2))
    mat.uniforms.uReveal.value = reveal
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uAlpha.value = alpha
    const mesh = packets.current
    if (!mesh) return
    for (let i = 0; i < N; i++) {
      const u = ((state.clock.elapsedTime * 0.12 + i / N) % 1) * reveal
      curve.getPointAt(Math.min(0.999, u), tmp.position)
      tmp.scale.setScalar(alpha > 0.01 && reveal > 0.02 ? 1 : 0.0001)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <mesh geometry={geo} material={mat} renderOrder={4} frustumCulled={false} />
      <instancedMesh ref={packets} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color="#e9ffd6" toneMapped={false} />
      </instancedMesh>
    </>
  )
}

/** The plain in-cab EcoStream unit: rounded white box, leaf logo, one status light. */
function CabUnit() {
  const logo = useLoader(THREE.TextureLoader, asset('logo-mark.png'))
  useEffect(() => {
    logo.colorSpace = THREE.SRGBColorSpace
  }, [logo])
  const led = useRef<THREE.MeshStandardMaterial>(null)
  useFrame((state) => {
    if (led.current) led.current.emissiveIntensity = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.8
  })
  return (
    <group position={JOURNEY.unit.toArray()}>
      <RoundedBox args={[0.5, 0.22, 0.34]} radius={0.06} smoothness={4} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.02, 0.172]}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0.18, -0.06, 0.172]}>
        <circleGeometry args={[0.018, 16]} />
        <meshStandardMaterial ref={led} color="#8CC152" emissive="#8CC152" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}

/** A simple lattice 4G tower with a blinking light. */
function Tower() {
  const top = JOURNEY.tower
  const h = top.y
  const blink = useRef<THREE.MeshStandardMaterial>(null)
  useFrame((state) => {
    if (blink.current) blink.current.emissiveIntensity = Math.sin(state.clock.elapsedTime * 3) > 0 ? 3 : 0.3
  })
  const legs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  return (
    <group position={[top.x, 0, top.z]}>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x * 0.6, h / 2, z * 0.6]} rotation={[z * 0.035, 0, -x * 0.035]}>
          <cylinderGeometry args={[0.06, 0.09, h, 6]} />
          <meshStandardMaterial color="#c7c3bb" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, 1.5 + i * 2, 0]}>
          <boxGeometry args={[1.6 - i * 0.12, 0.06, 1.6 - i * 0.12]} />
          <meshStandardMaterial color="#d8d4cb" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <mesh key={r} position={[Math.sin(r) * 0.55, h - 1.2, Math.cos(r) * 0.55]} rotation={[0, r, 0]}>
          <boxGeometry args={[0.35, 1.3, 0.12]} />
          <meshStandardMaterial color="#f4f4f2" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.2, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial ref={blink} color="#ff3b30" emissive="#ff3b30" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

/** Soft white cloud made of spheres. */
function Cloud() {
  const ref = useRef<THREE.Group>(null)
  const puffs = useMemo(
    () => [
      [0, 0, 0, 3.2],
      [3.2, -0.6, 0.4, 2.4],
      [-3.1, -0.7, -0.3, 2.5],
      [1.4, 1.3, -0.5, 2.3],
      [-1.5, 1.0, 0.6, 2.1],
      [5.2, -1.2, 0, 1.6],
      [-5.0, -1.2, 0.2, 1.5],
    ],
    [],
  )
  useFrame((state) => {
    if (ref.current) ref.current.position.y = JOURNEY.cloud.y + Math.sin(state.clock.elapsedTime * 0.6) * 0.3
  })
  return (
    <group ref={ref} position={JOURNEY.cloud.toArray()}>
      {puffs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 2]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff4e2" emissiveIntensity={0.35} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Phone screen drawn on a canvas, in the app's alert-card style. */
function usePhoneScreen() {
  const [fonts, setFonts] = useState(false)
  useEffect(() => {
    let alive = true
    ;(document.fonts?.ready ?? Promise.resolve()).then(() => alive && setFonts(true))
    return () => {
      alive = false
    }
  }, [])
  return useMemo(() => {
    const W = 540
    const H = 1100
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    const round = (x: number, y: number, w: number, h: number, r: number) => {
      g.beginPath()
      g.roundRect(x, y, w, h, r)
    }
    const head = (w: number, size: number) => `${w} ${size}px Montserrat, Arial, sans-serif`
    const body = (w: number, size: number) => `${w} ${size}px Inter, Arial, sans-serif`
    g.fillStyle = '#F4F9F1'
    g.fillRect(0, 0, W, H)
    // top bar
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, W, 120)
    g.font = head(800, 34)
    g.fillStyle = '#3E7231'
    g.fillText('ECO', 36, 80)
    const eco = g.measureText('ECO').width
    g.fillStyle = '#0B1E36'
    g.fillText('STREAM', 36 + eco, 80)
    // alert header
    round(28, 150, W - 56, 330, 28)
    g.fillStyle = '#E0A100'
    g.fill()
    g.fillStyle = '#0B1E36'
    g.font = head(700, 22)
    g.fillText('WARNING', 64, 205)
    g.font = head(800, 46)
    g.fillText('Slow leak', 64, 268)
    g.font = body(600, 28)
    g.fillText('Rear left, outer tyre', 64, 312)
    g.fillText('TN 99 ZZ 0001', 64, 352)
    round(64, 378, 330, 70, 14)
    g.fillStyle = '#0B1E36'
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = head(800, 30)
    g.fillText('UNSAFE IN ~3 H', 86, 424)
    // what to do
    round(28, 510, W - 56, 250, 24)
    g.fillStyle = '#ffffff'
    g.fill()
    g.fillStyle = '#0B1E36'
    g.font = head(800, 28)
    g.fillText('What to do now', 60, 562)
    g.font = body(500, 24)
    ;['Slow down, no hard braking', 'Go to the garage below', 'Check puncture and valve'].forEach((s, i) => {
      g.fillStyle = '#3E7231'
      g.beginPath()
      g.arc(76, 612 + i * 50, 15, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      g.font = head(800, 18)
      g.fillText(String(i + 1), 70, 619 + i * 50)
      g.fillStyle = '#1D323A'
      g.font = body(500, 24)
      g.fillText(s, 106, 620 + i * 50)
    })
    // garage
    round(28, 790, W - 56, 250, 24)
    g.fillStyle = '#ffffff'
    g.fill()
    g.fillStyle = '#0B1E36'
    g.font = head(800, 26)
    g.fillText('Sample Tyre Works 5', 60, 842)
    g.font = body(500, 22)
    g.fillStyle = '#1D323A'
    g.fillText('10.7 km away · Open 24×7', 60, 880)
    round(60, 920, 200, 84, 16)
    g.fillStyle = '#3E7231'
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = head(700, 28)
    g.fillText('Call', 128, 973)
    round(280, 920, 200, 84, 16)
    g.strokeStyle = '#3E7231'
    g.lineWidth = 5
    g.stroke()
    g.fillStyle = '#3E7231'
    g.fillText('Book slot', 310, 973)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [fonts])
}

function Phone() {
  const screen = usePhoneScreen()
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const p = story.progress.journey
    const show = ease(p, 0.72, 0.9) * (1 - ease(story.progress.map, 0.0, 0.2))
    if (!ref.current) return
    ref.current.visible = show > 0.001
    ref.current.scale.setScalar(0.001 + show)
    ref.current.position.y = JOURNEY.phone.y + Math.sin(state.clock.elapsedTime * 1.2) * 0.15
  })
  return (
    <group ref={ref} position={JOURNEY.phone.toArray()} visible={false}>
      <Billboard>
        <RoundedBox args={[4, 8, 0.3]} radius={0.45} smoothness={6} castShadow>
          <meshStandardMaterial color="#0B1E36" metalness={0.5} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.155]}>
          <planeGeometry args={[3.62, 7.36]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

export default function JourneyScene() {
  const curve = useMemo(() => {
    const { tyre, unit, tower, cloud, phone } = JOURNEY
    return new THREE.CatmullRomCurve3(
      [
        tyre,
        new THREE.Vector3(1.4, 1.6, -0.2),
        unit,
        new THREE.Vector3(7, 9, -2),
        tower,
        new THREE.Vector3(14, 22, -24),
        cloud,
        new THREE.Vector3(12, 17, -10),
        phone,
      ],
      false,
      'centripetal',
    )
  }, [])
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const show = ease(story.progress.journey, 0.0, 0.06)
    if (ref.current) ref.current.visible = show > 0.001 && story.progress.map < 0.4
  })
  return (
    <group ref={ref} visible={false}>
      <Stream curve={curve} />
      <Tower />
      <Cloud />
      <Phone />
    </group>
  )
}

/** The in-cab unit is part of the truck, so it's rendered inside the truck group. */
export { CabUnit }
