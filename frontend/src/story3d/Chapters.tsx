import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { asset } from '../lib/asset'
import { heatNow, hotLeakAt, ease, story } from '../landing3d/store'
import { ROUTE, TOWNS, GARAGES } from '../landing3d/corridor'
import { phases, SPOTS } from './phases'
import { makeAsphalt, makeGlow } from './textures'

/* ======================================================================
 * Hot is not a leak: two wheels on lit plinths in front of the truck.
 * ====================================================================== */
function StandWheel({ url, kind, pos }: { url: string; kind: 'hot' | 'leak'; pos: [number, number, number] }) {
  const gltf = useGLTF(asset(url), false, true)
  const { scene, tyre } = useMemo(() => {
    const s = gltf.scene.clone(true)
    let tyre: THREE.MeshStandardMaterial | null = null
    s.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const c = (x as THREE.MeshStandardMaterial).clone()
        if (c.name === 'rubber' || c.name === 'rubber_tread') tyre = c
        return c
      })
      m.material = Array.isArray(m.material) ? mats : mats[0]
    })
    // the tyre meshes share one material per name; collect both rubber materials
    const tyres: THREE.MeshStandardMaterial[] = []
    s.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
        if ((x as THREE.Material).name.startsWith('rubber')) tyres.push(x as THREE.MeshStandardMaterial)
      })
    })
    return { scene: s, tyre: tyres.length ? tyres : tyre ? [tyre] : [] }
  }, [gltf.scene])
  const g = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const ring = useRef<THREE.MeshStandardMaterial>(null)
  const heat = useMemo(() => new THREE.Color('#ff3a0a'), [])
  useFrame((_, dt) => {
    const ph = phases()
    const k = ph.hot
    if (g.current) {
      g.current.visible = k > 0.01
      g.current.scale.setScalar(0.001 + k)
    }
    if (spin.current) spin.current.rotation.x += dt * 0.6 * k
    const v = hotLeakAt(heatNow())
    const t = kind === 'hot' ? v.hot : v.leak
    const h = (t.temp - 30) / 55
    tyre.forEach((m) => {
      m.emissive.copy(heat)
      m.emissiveIntensity = h * h * 0.035
    })
    const alarm = kind === 'leak' && v.alert
    if (ring.current) {
      ring.current.emissive.set(alarm ? '#ffb020' : '#57d38c')
      ring.current.emissiveIntensity = 2.5 + (alarm ? Math.sin(performance.now() / 180) * 1.5 : 0)
    }
    if (label.current) {
      label.current.style.opacity = String(k > 0.6 ? 1 : 0)
      const q = (sel: string) => label.current!.querySelector(sel)!
      q('[data-t]').textContent = `${t.temp.toFixed(0)} °C`
      q('[data-g]').textContent = `${t.gauge.toFixed(1)} psi`
      q('[data-c]').textContent = `${t.corrected.toFixed(1)} psi`
      q('[data-s]').textContent = alarm ? 'Slow-leak alert' : kind === 'hot' ? 'No alarm: just heat' : 'Watching…'
      ;(q('[data-s]') as HTMLElement).className = `mt-1.5 rounded px-1.5 py-0.5 text-center font-semibold ${
        alarm ? 'bg-amber-400 text-black' : 'bg-white/10 text-[#9ff0c2]'
      }`
    }
  })
  return (
    <group ref={g} position={pos}>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.95, 1.0, 0.12, 64]} />
        <meshStandardMaterial color="#14191e" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 0.95, 96]} />
        <meshStandardMaterial ref={ring} color="#000" emissive="#57d38c" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <group ref={spin} position={[0, 0.66, 0]}>
        <primitive object={scene} />
      </group>
      <Html position={[0, 1.55, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={label}
          className="w-36 rounded-lg border border-white/15 bg-[#0b1218]/85 p-2 font-mono text-[10px] text-white/85 shadow-xl backdrop-blur transition-opacity duration-300"
          style={{ opacity: 0 }}
        >
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white">{kind === 'hot' ? 'Hot tyre' : 'Leaking tyre'}</p>
          <p className="flex justify-between"><span>Temp</span><span data-t /></p>
          <p className="flex justify-between"><span>Gauge</span><span data-g /></p>
          <p className="flex justify-between"><span>Corrected</span><span data-c /></p>
          <p data-s />
        </div>
      </Html>
    </group>
  )
}

export function HotLeakStands({ wheelUrl }: { wheelUrl: string }) {
  return (
    <>
      <StandWheel url={wheelUrl} kind="hot" pos={SPOTS.standA} />
      <StandWheel url={wheelUrl} kind="leak" pos={SPOTS.standB} />
    </>
  )
}

/* ======================================================================
 * Journey: tyre sensor -> sealed in-cab unit -> 4G tower -> cloud -> phone.
 * ====================================================================== */
const streamVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const streamFragment = /* glsl */ `
  uniform float uTime; uniform float uReveal; uniform vec3 uColor; varying vec2 vUv;
  void main(){
    if (vUv.x > uReveal) discard;
    float dash = smoothstep(0.35, 0.5, fract(vUv.x * 40.0 - uTime * 1.6));
    float head = smoothstep(uReveal - 0.03, uReveal, vUv.x);
    float a = 0.35 + 0.65 * dash + head * 2.0;
    gl_FragColor = vec4(uColor * (1.5 + head * 4.0), a);
  }`

function Tower() {
  const lattice = useMemo(() => {
    const pts: [THREE.Vector3, THREE.Vector3][] = []
    const H = 26
    const w = (y: number) => 1.6 * (1 - y / H) + 0.35
    const corners = (y: number) => [
      new THREE.Vector3(-w(y), y, -w(y)),
      new THREE.Vector3(w(y), y, -w(y)),
      new THREE.Vector3(w(y), y, w(y)),
      new THREE.Vector3(-w(y), y, w(y)),
    ]
    for (let y = 0; y < H; y += 2) {
      const a = corners(y)
      const b = corners(y + 2)
      for (let i = 0; i < 4; i++) {
        pts.push([a[i], b[i]], [a[i], a[(i + 1) % 4]], [a[i], b[(i + 1) % 4]])
      }
    }
    return pts
  }, [])
  const beacon = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = Math.sin(clock.elapsedTime * 3) > 0.6 ? 12 : 0.5
  })
  return (
    <group position={SPOTS.tower}>
      {lattice.map(([a, b], i) => {
        const mid = a.clone().add(b).multiplyScalar(0.5)
        const len = a.distanceTo(b)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
        return (
          <mesh key={i} position={mid} quaternion={q}>
            <cylinderGeometry args={[0.035, 0.035, len, 5]} />
            <meshStandardMaterial color="#8a9096" metalness={0.8} roughness={0.4} />
          </mesh>
        )
      })}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.55, 24.6, Math.sin((i * Math.PI * 2) / 3) * 0.55]} rotation-y={(-i * Math.PI * 2) / 3}>
          <boxGeometry args={[0.12, 1.4, 0.3]} />
          <meshStandardMaterial color="#d9dde2" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 26.3, 0]}>
        <sphereGeometry args={[0.16, 16, 8]} />
        <meshStandardMaterial ref={beacon} color="#300" emissive="#ff2020" emissiveIntensity={1} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function JourneyStream() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(...SPOTS.sensorFL),
        new THREE.Vector3(-0.6, 1.4, -3.6),
        new THREE.Vector3(...SPOTS.cabUnit),
        new THREE.Vector3(1.0, 4.2, -5.5),
        new THREE.Vector3(8, 15, -26),
        new THREE.Vector3(SPOTS.tower[0], 25, SPOTS.tower[2]),
        new THREE.Vector3(10, 45, -70),
        new THREE.Vector3(2, 70, -110),
      ]),
    [],
  )
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 400, 0.05, 8, false), [curve])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: streamVertex,
        fragmentShader: streamFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uColor: { value: new THREE.Color('#5fe39a') } },
      }),
    [],
  )
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const ph = phases()
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uReveal.value = ph.stream * (1 - ease(story.progress.map, 0.2, 0.5))
    if (g.current) g.current.visible = ph.stream > 0.001 && ph.drive < 0.01
  })
  return (
    <>
      <group ref={g}>
        <mesh geometry={geo} material={mat} raycast={() => null} />
      </group>
      <Tower />
    </>
  )
}

/* ======================================================================
 * Corridor map: a glowing map table that floats above the lay-by.
 * ====================================================================== */
const LON0 = 77.7
const LON1 = 80.6
const LAT0 = 10.9
const LAT1 = 13.4
const MAP_W = 64
const MAP_H = MAP_W * ((LAT1 - LAT0) / (LON1 - LON0))
export const MAP_Y = 40

function mapTexture() {
  const W = 2048
  const H = Math.round(W * (MAP_H / MAP_W))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const px = (lat: number, lon: number): [number, number] => [((lon - LON0) / (LON1 - LON0)) * W, ((LAT1 - lat) / (LAT1 - LAT0)) * H]
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#07131c')
  bg.addColorStop(1, '#0b1a14')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // grid
  g.strokeStyle = 'rgba(120,200,170,0.07)'
  g.lineWidth = 1
  for (let x = 0; x < W; x += 64) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y < H; y += 64) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  // coast (east edge: the Bay of Bengal)
  g.fillStyle = 'rgba(30,70,110,0.35)'
  g.beginPath()
  const [cx, cy] = px(13.4, 80.32)
  g.moveTo(cx, 0)
  g.lineTo(cx, cy)
  const [c2x, c2y] = px(12.0, 79.85)
  g.lineTo(c2x, c2y)
  const [c3x] = px(10.9, 79.8)
  g.lineTo(c3x, H)
  g.lineTo(W, H)
  g.lineTo(W, 0)
  g.fill()
  // route glow
  for (const [w, a] of [
    [26, 0.08],
    [12, 0.22],
    [5, 1],
  ] as const) {
    g.strokeStyle = `rgba(95,227,154,${a})`
    g.lineWidth = w
    g.lineJoin = 'round'
    g.beginPath()
    ROUTE.forEach(([la, lo], i) => {
      const [x, y] = px(la, lo)
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    })
    g.stroke()
  }
  // garages
  GARAGES.forEach(([la, lo]) => {
    const [x, y] = px(la, lo)
    g.fillStyle = 'rgba(95,227,154,0.25)'
    g.beginPath()
    g.arc(x, y, 18, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#5fe39a'
    g.beginPath()
    g.arc(x, y, 7, 0, Math.PI * 2)
    g.fill()
  })
  // towns
  g.font = '600 34px Inter, system-ui, sans-serif'
  TOWNS.forEach((t) => {
    const [x, y] = px(t.lat, t.lon)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(x, y, t.big ? 9 : 6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.88)'
    g.fillText(t.name, x + 18, y - 14)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function MapBoard() {
  const tex = useMemo(mapTexture, [])
  const g = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const truckDot = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const ph = phases()
    if (g.current) {
      g.current.visible = ph.map > 0.01
      g.current.position.y = MAP_Y - 6 * (1 - ph.map)
    }
    if (mat.current) mat.current.opacity = ph.map
    // a truck travelling the corridor, with an alert ping near Krishnagiri
    if (truckDot.current) {
      const u = (clock.elapsedTime * 0.04) % 1
      const i = Math.floor(u * (ROUTE.length - 1))
      const f = u * (ROUTE.length - 1) - i
      const [la, lo] = ROUTE[i].map((v, k) => v + (ROUTE[i + 1][k] - v) * f)
      truckDot.current.position.set(((lo - LON0) / (LON1 - LON0) - 0.5) * MAP_W, 0.4, ((LAT1 - la) / (LAT1 - LAT0) - 0.5) * MAP_H)
    }
  })
  return (
    <group ref={g} position={[0, MAP_Y, -4]}>
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[MAP_W, MAP_H]} />
        <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.9} transparent toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={truckDot}>
        <sphereGeometry args={[0.45, 20, 10]} />
        <meshStandardMaterial color="#000" emissive="#ffb020" emissiveIntensity={6} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

/* ======================================================================
 * Finale: the verified garage bay the truck drives into.
 * ====================================================================== */
function signTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#0d1a12'
  g.fillRect(0, 0, 1024, 256)
  g.fillStyle = '#ffffff'
  g.font = '800 92px Inter, system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('TYRE CARE', 40, 100)
  g.font = '600 44px Inter, system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.fillText('PUNCTURE · ALIGNMENT · 24 HRS', 40, 190)
  g.fillStyle = '#5fe39a'
  g.beginPath()
  g.roundRect(700, 40, 290, 110, 22)
  g.fill()
  g.fillStyle = '#05210f'
  g.font = '800 40px Inter, system-ui, sans-serif'
  g.fillText('VERIFIED', 740, 96)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Garage() {
  const sign = useMemo(signTexture, [])
  const glow = useMemo(() => makeGlow('#dff4ff'), [])
  const Z = SPOTS.garageFront
  const D = 13
  const W = 7.5
  const Hh = 5.2
  const concrete = useMemo(() => makeAsphalt(3, 21), [])
  const wall = <meshStandardMaterial {...concrete} color="#e2ddd3" roughness={0.95} />
  return (
    <group position={[0.2, 0, Z - D / 2]}>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#6f6e6a" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* walls + roof */}
      <mesh position={[-W / 2 - 0.15, Hh / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, Hh, D]} />
        {wall}
      </mesh>
      <mesh position={[W / 2 + 0.15, Hh / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, Hh, D]} />
        {wall}
      </mesh>
      <mesh position={[0, Hh / 2, -D / 2 - 0.15]} receiveShadow>
        <boxGeometry args={[W + 0.6, Hh, 0.3]} />
        {wall}
      </mesh>
      <mesh position={[0, Hh + 0.12, 0]} castShadow>
        <boxGeometry args={[W + 1.2, 0.24, D + 0.8]} />
        <meshStandardMaterial color="#5c6168" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* front header with the sign, rolled-up shutter */}
      <mesh position={[0, Hh - 0.45, D / 2 + 0.2]}>
        <boxGeometry args={[W + 0.6, 0.9, 0.4]} />
        <meshStandardMaterial color="#2a2f35" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, Hh + 0.75, D / 2 + 0.42]}>
        <planeGeometry args={[5.4, 1.35]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, Hh - 0.25, D / 2 - 0.1]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.28, 0.28, W, 24]} />
        <meshStandardMaterial color="#9ca2a8" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* strip lights */}
      {[-2.2, 0, 2.2].map((x) => (
        <group key={x}>
          <mesh position={[x, Hh - 0.05, 0]}>
            <boxGeometry args={[0.12, 0.05, D - 2]} />
            <meshStandardMaterial color="#000" emissive="#eaf6ff" emissiveIntensity={9} toneMapped={false} />
          </mesh>
          <pointLight position={[x, Hh - 0.6, 0]} intensity={90} distance={14} color="#e4f2ff" decay={2} />
        </group>
      ))}
      <sprite position={[0, 2.2, D / 2 + 0.2]} scale={[9, 5, 1]} raycast={() => null}>
        <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.12} />
      </sprite>
      {/* yellow bay lines, shelves of tyres on the back wall, a workbench */}
      {[-2.1, 2.1].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, 0.015, 0.5]}>
          <planeGeometry args={[0.12, D - 2]} />
          <meshStandardMaterial color="#e8b21a" roughness={0.6} />
        </mesh>
      ))}
      {[0.9, 2.0, 3.1].map((y) => (
        <group key={y}>
          <mesh position={[0, y, -D / 2 + 0.45]} castShadow>
            <boxGeometry args={[W - 1, 0.06, 0.6]} />
            <meshStandardMaterial color="#3a6ea5" metalness={0.5} roughness={0.5} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[-2.9 + i * 0.72, y + 0.36, -D / 2 + 0.45]} rotation-y={Math.PI / 2} castShadow>
              <torusGeometry args={[0.3, 0.12, 12, 28]} />
              <meshStandardMaterial color="#121315" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[-3.2, 0.5, -1.5]} castShadow>
        <boxGeometry args={[0.7, 1.0, 2.2]} />
        <meshStandardMaterial color="#b3261e" metalness={0.4} roughness={0.45} />
      </mesh>
      {/* tyre stacks and a compressor */}
      {[-3.2, 3.2].map((x) =>
        [0, 1, 2, 3].map((i) => (
          <mesh key={`${x}-${i}`} position={[x, 0.16 + i * 0.3, D / 2 - 2.5]} castShadow>
            <torusGeometry args={[0.42, 0.15, 16, 40]} />
            <meshStandardMaterial color="#141517" roughness={0.85} />
          </mesh>
        )),
      )}
      <mesh position={[3.1, 0.55, -D / 2 + 1.2]} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.7]} />
        <meshStandardMaterial color="#c0392b" roughness={0.45} metalness={0.2} />
      </mesh>
    </group>
  )
}

export function preloadChapterModels(urls: string[]) {
  urls.forEach((u) => useGLTF.preload(asset(u), false, true))
}
