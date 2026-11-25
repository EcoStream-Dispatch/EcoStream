import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Boxes, Eye, Layers, Lock, Pause, Play, RotateCcw, ScanEye } from 'lucide-react'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'
import type { ManifestModel, ModelAnimation, ModelMeta, ModelPart } from './types'

/*
 * Reusable viewer for the Blender-built models (see models/blender and frontend/public/models).
 *   <ModelViewer model={manifestEntry} meta={meta} />
 * - 360 degree orbit + zoom (limits from the model's metadata), auto-turn when idle
 * - tap / click a part (or pick it from the list) to inspect it: highlight + info card
 * - explode / assemble: slider, plus animated buttons that follow the assembly order
 * - per-part animations from the metadata (wheel spin, door hinge, tipper raise)
 * - prefers-reduced-motion: no auto-turn, no tweening (jumps straight to the end state)
 * - sealed parts (our sensor and in-cab unit) never explode and never show internals
 */

const HIGHLIGHT = new THREE.Color('#5C9A35')

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isLowPower() {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  return window.matchMedia('(max-width: 768px)').matches || (nav.deviceMemory ?? 8) <= 4
}

/** Load and cache a model's metadata JSON. */
export function useModelMeta(model: ManifestModel | undefined) {
  const [meta, setMeta] = useState<ModelMeta | null>(null)
  useEffect(() => {
    if (!model) return
    let alive = true
    fetch(asset(model.files.meta))
      .then((r) => r.json())
      .then((m: ModelMeta) => alive && setMeta(m))
      .catch(() => alive && setMeta(null))
    return () => {
      alive = false
    }
  }, [model])
  return meta
}

interface SceneState {
  explode: number // target 0..1
  selected: string | null
  playing: Record<string, boolean>
  reduced: boolean
  ghost: boolean
  focusNonce: number
}

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

function Model({
  url,
  meta,
  state,
  onSelect,
  onFocus,
}: {
  url: string
  meta: ModelMeta
  state: SceneState
  onSelect: (id: string | null) => void
  onFocus: () => void
}) {
  const gltf = useGLTF(url, false, true)
  // Own copy (with own materials) so highlighting one viewer never touches another.
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true)
    s.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone()
        m.castShadow = true
      }
    })
    return s
  }, [gltf.scene])

  const parts = useMemo(() => new Map(meta.parts.map((p) => [p.id, p])), [meta])
  const N = Math.max(...meta.parts.map((p) => p.order))
  const nodes = useMemo(() => {
    const out = new Map<string, { obj: THREE.Object3D; base: THREE.Vector3; baseQ: THREE.Quaternion }>()
    scene.traverse((o) => {
      if (parts.has(o.name) || meta.animations?.some((a) => a.node === o.name)) {
        out.set(o.name, { obj: o, base: o.position.clone(), baseQ: o.quaternion.clone() })
      }
    })
    return out
  }, [scene, parts, meta])

  // animated values
  const shown = useRef(state.explode)
  const angles = useRef<Record<string, number>>({})
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  // Our own sealed hardware gets a tag that follows it (it's small next to a 1 m wheel).
  const tagged = useMemo(() => meta.parts.filter((p) => p.sealed && !p.partOf), [meta])
  const tagRefs = useRef<Record<string, THREE.Group | null>>({})
  const tmpBox = useMemo(() => new THREE.Box3(), [])
  const ghostK = useRef(0)
  // meshes that go see-through, and the LED that pulses
  const { ghostMats, ledMats } = useMemo(() => {
    const ghostIds = new Set(meta.ghost ?? [])
    const g: THREE.MeshStandardMaterial[] = []
    const l: THREE.MeshStandardMaterial[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      let owner: THREE.Object3D | null = m
      let ghost = false
      while (owner && !ghost) {
        if (ghostIds.has(owner.name)) ghost = true
        owner = owner.parent
      }
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]
      if (ghost) g.push(...mats)
      if (meta.focus?.led && (m.name === meta.focus.led || m.parent?.name === meta.focus.led)) l.push(...mats)
    })
    return { ghostMats: g, ledMats: l }
  }, [scene, meta])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    // explode / assemble
    shown.current = state.reduced ? state.explode : shown.current + (state.explode - shown.current) * Math.min(1, d * 3.2)
    const e = shown.current
    for (const p of meta.parts) {
      const n = nodes.get(p.id)
      if (!n || p.sealed || !p.distance) continue
      const k = ease(THREE.MathUtils.clamp(e * N - (N - p.order), 0, 1))
      n.obj.position.copy(n.base).addScaledVector(tmpV.set(...p.explode), p.distance * k)
    }
    // per-part animations
    for (const a of meta.animations ?? []) {
      const n = nodes.get(a.node)
      if (!n) continue
      const cur = angles.current[a.id] ?? 0
      let next = cur
      if (a.type === 'rotate') {
        if (state.playing[a.id] && !state.reduced) next = cur + (a.speed ?? 1) * d * Math.PI
      } else {
        const target = state.playing[a.id] ? THREE.MathUtils.degToRad(a.maxAngle ?? 45) : 0
        next = state.reduced ? target : cur + (target - cur) * Math.min(1, d * 2.5)
      }
      angles.current[a.id] = next
      n.obj.quaternion.copy(n.baseQ).multiply(tmpQ.setFromAxisAngle(tmpV.set(...a.axis).normalize(), next))
    }
    // X-ray: fade the ghost parts
    const gTarget = state.ghost ? 1 : 0
    const gPrev = ghostK.current
    ghostK.current = state.reduced ? gTarget : gPrev + (gTarget - gPrev) * Math.min(1, d * 4)
    if (Math.abs(ghostK.current - gPrev) > 1e-4 || (ghostK.current > 0 && ghostMats[0]?.opacity === 1)) {
      for (const m of ghostMats) {
        m.transparent = ghostK.current > 0.01
        m.opacity = 1 - 0.85 * ghostK.current
        m.depthWrite = ghostK.current < 0.5
        m.needsUpdate = true
      }
    }
    // status LED: gentle pulse while the sensor is in focus
    if (ledMats.length) {
      const on = (state.ghost || (meta.focus && state.selected === meta.focus.part)) && !state.reduced
      for (const m of ledMats) {
        const base = m.userData.baseEmissive?.i ?? m.emissiveIntensity
        if (!m.userData.baseEmissive) m.userData.baseEmissive = { c: m.emissive.clone(), i: base }
        m.emissive.copy(m.userData.baseEmissive.c)
        m.emissiveIntensity = on ? base * (0.55 + 0.45 * Math.sin(performance.now() / 260)) + base * 0.45 : base
      }
    }
    // keep sensor tags on their part (it moves with spin / explode)
    for (const p of tagged) {
      const g = tagRefs.current[p.id]
      const n = nodes.get(p.id)
      if (!g || !n) continue
      n.obj.updateWorldMatrix(true, true)
      tmpBox.setFromObject(n.obj).getCenter(g.position)
    }
  })

  // highlight the selected part
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      let owner: THREE.Object3D | null = m
      let id: string | null = null
      while (owner && !id) {
        const p = parts.get(owner.name)
        if (p) id = p.partOf ?? p.id
        owner = owner.parent
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats as THREE.MeshStandardMaterial[]) {
        if (!mat.userData.baseEmissive) mat.userData.baseEmissive = { c: mat.emissive.clone(), i: mat.emissiveIntensity }
        // our sealed units keep their real look when picked (the tag + LED show the selection)
        const on = state.selected && id === state.selected && !parts.get(id)?.sealed
        mat.emissive.copy(on ? HIGHLIGHT : mat.userData.baseEmissive.c)
        mat.emissiveIntensity = on ? 0.55 : mat.userData.baseEmissive.i
      }
    })
  }, [scene, parts, state.selected])

  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation()
    let o: THREE.Object3D | null = ev.object
    while (o) {
      const p = parts.get(o.name)
      if (p) return onSelect(p.partOf ?? p.id)
      o = o.parent
    }
  }

  const sel = state.selected ? parts.get(state.selected) : null
  return (
    <group>
      <primitive object={scene} onClick={onClick} onPointerMissed={() => onSelect(null)} />
      {tagged.map((p) => (
        <group key={p.id} ref={(g) => (tagRefs.current[p.id] = g)} position={p.hotspot}>
          {state.selected !== p.id && (
            <Html center zIndexRange={[19, 0]}>
              <button
                type="button"
                onClick={() => (meta.focus?.part === p.id ? onFocus() : onSelect(p.id))}
                className="relative flex h-11 w-11 items-center justify-center"
                aria-label={p.label}
                title={p.label}
              >
                <span className="absolute h-8 w-8 animate-ping rounded-full ring-2 ring-green-400/70 motion-reduce:animate-none" aria-hidden />
                <span className="absolute h-8 w-8 rounded-full ring-2 ring-green-500" aria-hidden />
                <span className="absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-navy-900/85 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                  {p.label}
                </span>
              </button>
            </Html>
          )}
        </group>
      ))}
      {sel && !tagged.some((p) => p.id === sel.id) && (
        <Html position={sel.hotspot} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="block h-4 w-4 rounded-full bg-green-500 ring-4 ring-green-300/50" aria-hidden />
        </Html>
      )}
    </group>
  )
}

function Fit({ meta }: { meta: ModelMeta }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const c = meta.camera
    if (!c) return
    const k = size.width / size.height < 0.8 ? 1.45 : 1
    camera.position.set(c.position[0] * k, c.position[1] * k, c.position[2] * k)
    camera.lookAt(...c.target)
  }, [camera, meta, size.width, size.height])
  return null
}

/** Fly the camera to the focus part (Show sensor). Stops as soon as the user drags. */
function FocusFly({ meta, nonce, reduced, controlsRef }: { meta: ModelMeta; nonce: number; reduced: boolean; controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, scene } = useThree()
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null)
  useEffect(() => {
    const f = meta.focus
    const controls = controlsRef.current
    if (!nonce || !f || !controls) return
    const node = scene.getObjectByName(f.part)
    if (!node) return
    node.updateWorldMatrix(true, true)
    const target = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())
    let dir: THREE.Vector3
    if (f.direction) dir = new THREE.Vector3(...f.direction)
    else {
      // outboard (+X) and a little outward from the wheel centre, so the face with the LED shows
      const radial = new THREE.Vector3(0, target.y, target.z).normalize()
      dir = new THREE.Vector3(1, 0, 0).addScaledVector(radial, 0.55)
    }
    const pos = target.clone().addScaledVector(dir.normalize(), f.distance ?? 0.4)
    goal.current = { pos, target, t: 0 }
    if (reduced) {
      camera.position.copy(pos)
      controls.target.copy(target)
      controls.update()
      goal.current = null
    }
    const stop = () => (goal.current = null)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [nonce])
  useFrame((_, dt) => {
    const g = goal.current
    const controls = controlsRef.current
    if (!g || !controls) return
    g.t += Math.min(dt, 0.05)
    const k = Math.min(1, dt * 3.5)
    camera.position.lerp(g.pos, k)
    controls.target.lerp(g.target, k)
    controls.update()
    if (g.t > 1.6) goal.current = null
  })
  return null
}

function Loading() {
  return (
    <Html center>
      <span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy-900 shadow">Loading model…</span>
    </Html>
  )
}

export default function ModelViewer({
  model,
  meta,
  className = '',
  height = 'h-[460px] md:h-[560px]',
  showPartList = true,
}: {
  model: ManifestModel
  meta: ModelMeta
  className?: string
  height?: string
  showPartList?: boolean
}) {
  const { t } = useLang()
  const reduced = useMemo(prefersReducedMotion, [])
  const [detail, setDetail] = useState<'high' | 'low'>(() => (isLowPower() ? 'low' : 'high'))
  const [explode, setExplode] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState<Record<string, boolean>>({})
  const [interacted, setInteracted] = useState(false)
  const [ghost, setGhost] = useState(false)
  const [focusNonce, setFocusNonce] = useState(0)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const focus = meta.focus
  const showFocus = () => {
    if (!focus) return
    setInteracted(true)
    if (focus.ghost) setGhost(true)
    setSelected(focus.part)
    // hold still so the camera can find it
    setPlaying((p) => Object.fromEntries(Object.keys(p).map((k) => [k, false])))
    setFocusNonce((n) => n + 1)
  }

  const visibleParts = meta.parts.filter((p) => !p.partOf).sort((a, b) => a.order - b.order)
  const sel = selected ? meta.parts.find((p) => p.id === selected) : null
  const cam = meta.camera ?? { position: [2, 1, 2], target: [0, 0, 0], minDistance: 0.5, maxDistance: 6 }
  const state: SceneState = { explode, selected, playing, reduced, ghost, focusNonce }
  const anims: ModelAnimation[] = meta.animations ?? []

  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-green-500/15 ${className}`}>
      <div className={`relative ${height} bg-gradient-to-b from-green-50 to-white`}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: 35, near: 0.05, far: 200, position: cam.position }}
          onPointerDown={() => setInteracted(true)}
          gl={{ antialias: true }}
          aria-label={`${meta.title}: 3D model. Drag to turn, scroll or pinch to zoom, tap a part to inspect it.`}
        >
          <Environment />
          <ambientLight intensity={0.3} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
          <Fit meta={meta} />
          <Suspense fallback={<Loading />}>
            <Model url={asset(model.files[detail].url)} meta={meta} state={state} onSelect={setSelected} onFocus={showFocus} />
          </Suspense>
          <ContactShadows position={[0, meta.ground ?? 0, 0]} opacity={0.35} scale={meta.shadowScale ?? 4} blur={2.5} far={4} />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={cam.target}
            enableDamping
            minDistance={focusNonce ? Math.min(cam.minDistance, 0.2) : cam.minDistance}
            maxDistance={cam.maxDistance}
            autoRotate={!reduced && !interacted && !selected}
            autoRotateSpeed={0.8}
          />
          <FocusFly meta={meta} nonce={focusNonce} reduced={reduced} controlsRef={controlsRef} />
        </Canvas>

        {/* info card */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-start md:inset-x-4 md:bottom-4">
          {sel ? (
            <div className="pointer-events-auto max-w-sm rounded-xl bg-white/95 p-4 shadow-lg ring-1 ring-green-500/20" role="status" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading text-base font-bold text-navy-900">{sel.label}</p>
                <button type="button" onClick={() => setSelected(null)} className="min-h-[32px] rounded px-2 text-sm font-semibold text-navy-700 hover:bg-gray-100">
                  {t('mv.close')}
                </button>
              </div>
              <p className="mt-1 text-sm text-navy-700">{sel.description}</p>
              {sel.sealed && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                  <Lock size={13} aria-hidden /> {t('mv.sealed')}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-navy-700 shadow">{t('mv.hint')}</p>
          )}
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-navy-700 shadow">
          {t('mv.blender')}
        </span>
      </div>

      {/* controls */}
      <div className="space-y-4 border-t border-green-500/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-3">
            <span className="shrink-0 text-sm font-semibold text-navy-900">{t('mv.explodeLabel')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(explode * 100)}
              onChange={(e) => setExplode(Number(e.target.value) / 100)}
              className="h-11 w-full accent-green-700"
              aria-label={t('mv.explodeLabel')}
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => setExplode(1)} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-500">
              <Layers size={16} aria-hidden /> {t('mv.explode')}
            </button>
            <button type="button" onClick={() => setExplode(0)} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border-2 border-green-700 px-4 text-sm font-semibold text-green-700 hover:bg-green-50">
              <Boxes size={16} aria-hidden /> {t('mv.assemble')}
            </button>
          </div>
        </div>

        {(anims.length > 0 || focus || meta.ghost?.length) && (
          <div className="flex flex-wrap gap-2">
            {focus && (
              <button
                type="button"
                onClick={showFocus}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-green-700 px-3 text-sm font-semibold text-white hover:bg-green-500"
              >
                <ScanEye size={16} aria-hidden /> {focus.label}
              </button>
            )}
            {!!meta.ghost?.length && (
              <button
                type="button"
                aria-pressed={ghost}
                onClick={() => setGhost((g) => !g)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 transition ${
                  ghost ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-900 ring-gray-300 hover:ring-green-500'
                }`}
              >
                <Eye size={16} aria-hidden /> {meta.ghostLabel ?? t('mv.ghost')}
              </button>
            )}
            {anims.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={!!playing[a.id]}
                onClick={() => setPlaying((p) => ({ ...p, [a.id]: !p[a.id] }))}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 transition ${
                  playing[a.id] ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-900 ring-gray-300 hover:ring-green-500'
                }`}
              >
                {a.type === 'rotate' ? playing[a.id] ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden /> : <RotateCcw size={16} aria-hidden />}
                {a.label}
              </button>
            ))}
            {reduced && anims.some((a) => a.type === 'rotate') && <span className="self-center text-xs text-navy-700">{t('mv.reduced')}</span>}
          </div>
        )}

        {showPartList && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-700">{t('mv.parts')}</p>
            <ul className="flex flex-wrap gap-2">
              {visibleParts.map((p: ModelPart) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={selected === p.id}
                    onClick={() => setSelected(selected === p.id ? null : p.id)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 transition ${
                      selected === p.id ? 'bg-green-700 text-white ring-green-700' : 'bg-green-50 text-navy-900 ring-green-500/20 hover:ring-green-500'
                    }`}
                  >
                    {p.sealed && <Lock size={13} aria-hidden />}
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-navy-700">
          <span>
            {t('mv.detail')}:{' '}
            {(['high', 'low'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={detail === d}
                onClick={() => setDetail(d)}
                className={`ml-1 min-h-[32px] rounded px-2 font-semibold ${detail === d ? 'bg-navy-900 text-white' : 'hover:bg-gray-100'}`}
              >
                {d === 'high' ? t('mv.high') : t('mv.low')} ({Math.round(model.files[d].bytes / 1024)} KB)
              </button>
            ))}
          </span>
          <span>{t('mv.scale')}</span>
        </div>
      </div>
    </div>
  )
}
