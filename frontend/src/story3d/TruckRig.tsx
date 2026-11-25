import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { asset } from '../lib/asset'
import { leakAt } from '../landing3d/store'
import { phases, SPOTS } from './phases'
import { LightCone } from './NightWorld'
import { addGrime } from './grime'

/*
 * The Blender truck (frontend/public/models/truck.glb) in the night story.
 * - X-ray: body panels fade to glass with glowing edges, tyres turn translucent so the
 *   sealed sensors on the rims show, every tyre gets a live label.
 * - Slow leak: the rear-left outer tyre pulses amber.
 * - Journey: the cab goes see-through and the sealed in-cab unit's LED pulses.
 * - Finale: the truck drives forward into the garage bay (wheels roll).
 * Patent rule: the sensors and in-cab unit are only ever their sealed shells.
 */

const TYRE_MATS = new Set(['rubber', 'rubber_tread'])
const WHEEL_METAL = new Set(['rim_paint', 'hub_green', 'chrome', 'zinc_stud', 'valve_brass'])
const SENSOR_MATS = new Set(['sensor_shell', 'sensor_band', 'sensor_seam', 'sensor_led', 'unit_shell', 'unit_band', 'unit_led'])
const CAB_NODES = new Set(['cab', 'door_left', 'door_right'])

/** Wheel node -> app tyre id and demo reading (psi corrected to 20 °C, °C). */
export const WHEEL_LABELS: Record<string, { id: string; psi: number; temp: number }> = {
  wheel_fl: { id: 'FL', psi: 119.6, temp: 49 },
  wheel_fr: { id: 'FR', psi: 120.2, temp: 50 },
  wheel_r1lo: { id: 'RL1-O', psi: 110.0, temp: 54 },
  wheel_r1li: { id: 'RL1-I', psi: 119.1, temp: 55 },
  wheel_r1ri: { id: 'RR1-I', psi: 120.4, temp: 55 },
  wheel_r1ro: { id: 'RR1-O', psi: 119.8, temp: 54 },
  wheel_r2lo: { id: 'RL2-O', psi: 119.4, temp: 53 },
  wheel_r2li: { id: 'RL2-I', psi: 120.0, temp: 55 },
  wheel_r2ri: { id: 'RR2-I', psi: 119.7, temp: 56 },
  wheel_r2ro: { id: 'RR2-O', psi: 120.1, temp: 53 },
}

interface Ghostable {
  mat: THREE.MeshStandardMaterial
  baseOpacity: number
  baseTransparent: boolean
  baseEmissive: THREE.Color
  baseEmissiveI: number
}

export default function TruckRig({ url, labels = true }: { url: string; labels?: boolean }) {
  const gltf = useGLTF(asset(url), false, true)
  const group = useRef<THREE.Group>(null)

  const rig = useMemo(() => {
    const scene = gltf.scene.clone(true)
    const body: Ghostable[] = []
    const cab: Ghostable[] = []
    const tyres: Ghostable[] = []
    const wheels: { node: THREE.Object3D; q: THREE.Quaternion; axis: THREE.Vector3 }[] = []
    let leakTyre: THREE.MeshStandardMaterial | null = null
    const leds: THREE.MeshStandardMaterial[] = []
    const edges: THREE.LineSegments[] = []
    const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#7fe0b0'), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    const seen = new Map<THREE.Material, THREE.MeshStandardMaterial>()
    const wrap = (m: THREE.MeshStandardMaterial): Ghostable => ({
      mat: m,
      baseOpacity: m.opacity,
      baseTransparent: m.transparent,
      baseEmissive: m.emissive.clone(),
      baseEmissiveI: m.emissiveIntensity,
    })

    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (/^wheel_[a-z0-9]+$/.test(o.name)) {
        const left = WHEEL_LABELS[o.name]?.id.includes('L') ?? false
        wheels.push({ node: o, q: o.quaternion.clone(), axis: new THREE.Vector3(left ? 1 : -1, 0, 0) })
      }
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      // which top-level part is this in?
      let top: THREE.Object3D = mesh
      let inWheel = ''
      for (let p: THREE.Object3D | null = mesh; p; p = p.parent) {
        if (/^wheel_[a-z0-9]+$/.test(p.name)) inWheel = p.name
        if (p.parent && p.parent.name === 'truck') top = p
      }
      const inCab = CAB_NODES.has(top.name) || top.name === 'cab'
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]
      const out = mats.map((m0) => {
        const name = m0.name
        // the leaking tyre gets its own material so only it can glow amber
        if (inWheel === 'wheel_r1lo' && TYRE_MATS.has(name)) {
          const m = m0.clone()
          leakTyre = m
          tyres.push(wrap(m))
          return m
        }
        if (seen.has(m0)) return seen.get(m0)!
        const m = m0.clone()
        seen.set(m0, m)
        if (SENSOR_MATS.has(name)) {
          if (name.endsWith('led')) leds.push(m)
        } else if (TYRE_MATS.has(name)) tyres.push(wrap(m))
        else if (!WHEEL_METAL.has(name)) {
          ;(inCab ? cab : body).push(wrap(m))
        }
        return m
      })
      mesh.material = Array.isArray(mesh.material) ? out : out[0]
      // glowing edges on the big body parts (shown in the X-ray)
      if (!inWheel && ['cab', 'tipper_body', 'chassis', 'door_left', 'door_right'].includes(top.name) && mesh.geometry.attributes.position.count < 400000) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 35), edgeMat)
        e.raycast = () => {}
        e.visible = false
        mesh.add(e)
        edges.push(e)
      }
    })
    // road dust: body paint, chassis, tyres and wheel metal (not glass, lamps or our sealed units)
    seen.forEach((m) => {
      const n = m.name
      if (SENSOR_MATS.has(n) || /glass|lens|headlight|reflector|amber|tail_red|gravel|unit_|plate/.test(n)) return
      const tyre = TYRE_MATS.has(n)
      addGrime(m, tyre ? 0.7 : n.includes('chassis') || n.includes('steel') ? 1.0 : 0.85, tyre ? 1.1 : 1.45)
    })
    if (leakTyre) addGrime(leakTyre as THREE.MeshStandardMaterial, 0.7, 1.1)
    // a cab material used by both groups would be listed once: dedupe by material
    const uniq = (a: Ghostable[]) => a.filter((g, i) => a.findIndex((h) => h.mat === g.mat) === i)
    return { scene, body: uniq(body), cab: uniq(cab), tyres: uniq(tyres), wheels, leakTyre: leakTyre as THREE.MeshStandardMaterial | null, leds, edges, edgeMat }
  }, [gltf.scene])

  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const amber = useMemo(() => new THREE.Color('#ffb020'), [])
  const green = useMemo(() => new THREE.Color('#57d38c'), [])
  const roll = useRef(0)
  const lastZ = useRef(0)
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const leakLabel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => () => rig.edges.forEach((e) => e.geometry.dispose()), [rig])

  useFrame((state) => {
    const ph = phases()
    const t = state.clock.elapsedTime
    const ghostBody = Math.max(ph.xray, 0)
    const ghostCab = Math.max(ph.xray, ph.cab)
    const fade = (g: Ghostable, k: number, min: number) => {
      const o = 1 - k * (1 - min)
      g.mat.transparent = g.baseTransparent || k > 0.01
      g.mat.opacity = g.baseOpacity * o
      g.mat.depthWrite = k < 0.5
    }
    rig.body.forEach((g) => fade(g, ghostBody, 0.07))
    rig.cab.forEach((g) => fade(g, ghostCab, 0.08))
    rig.tyres.forEach((g) => {
      fade(g, ph.xray, 0.35)
      g.mat.emissive.copy(green)
      g.mat.emissiveIntensity = ph.xray * 0.18
    })
    if (rig.leakTyre && ph.leak > 0.01) {
      rig.leakTyre.emissive.copy(amber)
      rig.leakTyre.emissiveIntensity = ph.leak * (0.55 + 0.35 * Math.sin(t * 3.2))
    }
    rig.edgeMat.opacity = Math.max(ghostBody, ph.cab * 0.6) * 0.55
    const showEdges = rig.edgeMat.opacity > 0.01
    rig.edges.forEach((e) => (e.visible = showEdges))
    rig.leds.forEach((m) => (m.emissiveIntensity = 4 + 4 * Math.max(ph.cab, ph.xray) * (0.5 + 0.5 * Math.sin(t * 4))))

    // finale: drive into the garage bay; wheels roll with the distance covered
    const z = SPOTS.driveTo * ph.drive
    if (group.current) group.current.position.z = z
    roll.current += (lastZ.current - z) / SPOTS.wheelRadius
    lastZ.current = z
    rig.wheels.forEach((w) => w.node.quaternion.copy(w.q).multiply(tmpQ.setFromAxisAngle(w.axis, roll.current + t * 0)))

    // labels
    const showL = ph.xray > 0.5 && ph.hot < 0.5 && ph.leak < 0.3
    for (const [k, el] of Object.entries(labelRefs.current)) {
      if (!el) continue
      const leaking = k === 'wheel_r1lo' && ph.leak > 0.3
      el.style.opacity = String(showL ? (leaking ? 0 : 1) : 0)
    }
    if (leakLabel.current) {
      const v = leakAt(Math.min(1, ph.leak * 1.2))
      leakLabel.current.style.opacity = String(ph.leak > 0.3 ? 1 : 0)
      leakLabel.current.querySelector('[data-psi]')!.textContent = `${v.psi.toFixed(1)} psi`
    }
  })

  const wheelPos = (name: string): [number, number, number] => {
    const n = rig.wheels.find((w) => w.node.name === name)?.node
    return n ? [n.position.x + (n.position.x < 0 ? -0.2 : 0.2), 1.25, n.position.z] : [0, 0, 0]
  }

  return (
    <group ref={group}>
      <primitive object={rig.scene} />
      {/* headlights: warm spots + soft beams */}
      {[-0.95, 0.95].map((x) => (
        <HeadLamp key={x} x={x} />
      ))}
      {labels &&
        Object.entries(WHEEL_LABELS).map(([name, v]) => (
          <Html key={name} position={wheelPos(name)} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
            <div
              ref={(el) => (labelRefs.current[name] = el)}
              className="whitespace-nowrap rounded-md border border-white/15 bg-[#0b1218]/80 px-2 py-1 font-mono text-[10px] text-white/90 shadow-lg backdrop-blur transition-opacity duration-300"
              style={{ opacity: 0 }}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#57d38c]" />
              {v.id} · {v.psi.toFixed(1)} psi · {v.temp} °C
            </div>
          </Html>
        ))}
      {labels && (
        <Html position={[SPOTS.leakWheel[0] - 0.35, 1.55, SPOTS.leakWheel[2]]} center zIndexRange={[16, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={leakLabel}
            className="whitespace-nowrap rounded-md border border-amber-300/50 bg-[#1d1407]/85 px-2.5 py-1.5 font-mono text-[11px] text-amber-200 shadow-lg backdrop-blur transition-opacity duration-300"
            style={{ opacity: 0 }}
          >
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            RL1-O · <span data-psi>110.0 psi</span> · falling 3 psi/h
          </div>
        </Html>
      )}
    </group>
  )
}

function HeadLamp({ x }: { x: number }) {
  const light = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    if (light.current) light.current.target = target
  }, [target])
  return (
    <group position={[x, 1.62, -4.32]}>
      <spotLight ref={light} color="#fff1d6" intensity={180} distance={42} angle={0.4} penumbra={0.65} decay={2} />
      <primitive object={target} position={[x * 0.6, -1.62, -20]} />
      <group rotation={[Math.PI / 2 - 0.07, 0, 0]}>
        <LightCone height={12} radius={2.6} color="#fff3df" strength={0.05} />
      </group>
    </group>
  )
}
