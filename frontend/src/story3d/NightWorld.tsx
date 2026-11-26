import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeAsphalt, makeGlow, makeGrass, makeRoadLines } from './textures'
import { quality } from './state'

/*
 * Night highway lay-by. The truck (Blender model) faces -Z and is parked at the origin.
 *   road:     x -11 .. -3.2 (two lanes, driving along z)
 *   lay-by:   x -3.2 .. 4  (concrete-asphalt shoulder where the truck stands)
 *   lamps:    x = 4.6, every 14 m, sodium-orange, shining down on the lay-by
 *   barrier:  x = 5.6; beyond it scrub, trees, hills and a distant town glow
 * Everything is procedural: geometry here, textures drawn on canvases (textures.ts).
 */

export const LAMP_ZS = [-17, -3, 11]
const SODIUM = '#ffad5c'

const coneVertex = /* glsl */ `
  varying float vY; varying vec3 vN; varying vec3 vView;
  void main() {
    vY = uv.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const coneFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uStrength; varying float vY; varying vec3 vN; varying vec3 vView;
  void main() {
    float edge = pow(abs(dot(vN, vView)), 1.6);
    float a = edge * pow(vY, 1.8) * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
`

/** Fake volumetric light cone (additive, soft at the edges, fading towards the ground). */
export function LightCone({ height, radius, color = SODIUM, strength = 0.22 }: { height: number; radius: number; color?: string; strength?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coneVertex,
        fragmentShader: coneFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
      }),
    [color, strength],
  )
  return (
    <mesh position={[0, -height / 2, 0]} material={mat} raycast={() => null}>
      <coneGeometry args={[radius, height, 48, 1, true]} />
    </mesh>
  )
}

function StreetLamp({ z, shadow }: { z: number; shadow: boolean }) {
  const light = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    if (light.current) light.current.target = target
  }, [target])
  return (
    <group position={[4.6, 0, z]}>
      {/* pole, base, arm */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.5, 20]} />
        <meshStandardMaterial color="#5d6166" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 4.6, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 9.2, 16]} />
        <meshStandardMaterial color="#7b8086" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[-1.1, 9.15, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 2.3, 12]} />
        <meshStandardMaterial color="#7b8086" metalness={0.75} roughness={0.35} />
      </mesh>
      {/* lamp head + glowing lens */}
      <mesh position={[-2.15, 9.02, 0]} castShadow>
        <boxGeometry args={[0.75, 0.14, 0.34]} />
        <meshStandardMaterial color="#3b3f44" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-2.15, 8.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.62, 0.26]} />
        <meshStandardMaterial color="#000" emissive={SODIUM} emissiveIntensity={14} toneMapped={false} />
      </mesh>
      <group position={[-2.15, 8.9, 0]}>
        <LightCone height={8.9} radius={4.2} strength={quality.low ? 0.12 : 0.16} />
      </group>
      <spotLight
        ref={light}
        position={[-2.15, 8.85, 0]}
        color={SODIUM}
        intensity={shadow ? 950 : 520}
        distance={26}
        angle={0.72}
        penumbra={0.75}
        decay={2}
        castShadow={shadow}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={22}
      />
      <primitive object={target} position={[-2.6, 0, 0]} />
    </group>
  )
}

/** Steel W-beam crash barrier on posts. */
function Barrier() {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    const pts: [number, number][] = [
      [0, 0], [0.05, 0.04], [0.05, 0.12], [0, 0.16], [0, 0.2], [0.05, 0.24], [0.05, 0.32], [0, 0.36],
      [0.008, 0.36], [0.058, 0.32], [0.058, 0.24], [0.008, 0.2], [0.008, 0.16], [0.058, 0.12], [0.058, 0.04], [0.008, 0],
    ]
    s.moveTo(...pts[0])
    pts.slice(1).forEach((p) => s.lineTo(...p))
    return s
  }, [])
  const len = 90
  return (
    <group position={[5.6, 0.45, 0]}>
      <mesh position={[0, 0, len / 2]} rotation={[0, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: len, bevelEnabled: false, steps: 1 }]} />
        <meshStandardMaterial color="#9aa1a8" metalness={0.85} roughness={0.32} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 23 }, (_, i) => (
        <mesh key={i} position={[0.12, -0.05, -len / 2 + i * 4]} castShadow>
          <boxGeometry args={[0.1, 0.85, 0.14]} />
          <meshStandardMaterial color="#6f757b" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
    </group>
  )
}

/** Traffic cones (the driver has stopped in the lay-by). */
function Cone({ position }: { position: [number, number, number] }) {
  const pts = useMemo(
    () => [new THREE.Vector2(0.0, 0.75), new THREE.Vector2(0.03, 0.74), new THREE.Vector2(0.17, 0.05), new THREE.Vector2(0.17, 0.0), new THREE.Vector2(0, 0)],
    [],
  )
  return (
    <group position={position}>
      <mesh castShadow>
        <latheGeometry args={[pts, 32]} />
        <meshPhysicalMaterial color="#ff5a14" roughness={0.45} clearcoat={0.6} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.092, 0.118, 0.13, 32, 1, true]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.2} metalness={0.3} emissive="#ffffff" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.04, 0.44]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** Night sky: deep blue-black gradient, a faint town glow on the horizon, stars and the moon. */
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec3 vP;
          void main(){
            float h = vP.y;
            vec3 top = vec3(0.004, 0.007, 0.016);
            vec3 hor = vec3(0.03, 0.045, 0.07);
            vec3 c = mix(hor, top, smoothstep(0.0, 0.45, h));
            // warm town glow, low on the horizon behind the barrier (+x)
            float town = pow(max(0.0, dot(normalize(vec3(vP.x, 0.0, vP.z)), normalize(vec3(1.0, 0.0, -0.35)))), 6.0);
            c += vec3(0.16, 0.08, 0.03) * town * smoothstep(0.18, 0.0, h) * smoothstep(-0.05, 0.02, h);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  )
  const stars = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 1600
    const p = new Float32Array(n * 3)
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2
      const ph = Math.acos(1 - r() * 0.95)
      p[i * 3] = Math.sin(ph) * Math.cos(th) * 380
      p[i * 3 + 1] = Math.cos(ph) * 380
      p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 380
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  const moon = useMemo(() => makeGlow('#dfe9ff'), [])
  return (
    <group>
      <mesh material={mat} raycast={() => null}>
        <sphereGeometry args={[400, 32, 16]} />
      </mesh>
      <points geometry={stars} raycast={() => null}>
        <pointsMaterial color="#cfd8ff" size={1.1} sizeAttenuation={false} fog={false} transparent opacity={0.8} />
      </points>
      <sprite position={[-150, 140, -220]} scale={[60, 60, 1]}>
        <spriteMaterial map={moon} fog={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} />
      </sprite>
    </group>
  )
}

/** Tree and hill silhouettes beyond the barrier and across the road. */
function Silhouettes() {
  const trees = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = []
    let s = 21
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 70; i++) {
      const side = r() < 0.6 ? 1 : -1
      const x = side > 0 ? 16 + r() * 40 : -22 - r() * 40
      out.push({ p: [x, 0, -70 + r() * 120], s: 0.7 + r() * 1.1 })
    }
    return out
  }, [])
  // layered pine silhouette: three stacked, slightly jittered cones
  const pine = useMemo(() => {
    const parts = [0, 1, 2].map((i) => {
      const g = new THREE.ConeGeometry(1.0 - i * 0.24, 1.3 - i * 0.15, 11, 1)
      g.translate(0, -0.55 + i * 0.55, 0)
      const pos = g.attributes.position
      for (let k = 0; k < pos.count; k++) {
        if (pos.getY(k) < -0.5 + i * 0.55) {
          const a = Math.atan2(pos.getZ(k), pos.getX(k))
          const r = 1 + 0.18 * Math.sin(a * 5 + i * 2)
          pos.setX(k, pos.getX(k) * r)
          pos.setZ(k, pos.getZ(k) * r)
        }
      }
      return g
    })
    const m = mergeGeometries(parts)!
    m.computeVertexNormals()
    return m
  }, [])
  const mesh = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.p[0], 4.2 * t.s, t.p[2]), new THREE.Quaternion(), new THREE.Vector3(2.4 * t.s, 3.8 * t.s, 2.4 * t.s))
      mesh.current?.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(t.p[0], 0.9 * t.s, t.p[2]), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s))
      trunks.current?.setMatrixAt(i, m)
    })
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
  }, [trees])
  return (
    <group>
      <instancedMesh ref={mesh} args={[pine, undefined, trees.length]} castShadow raycast={() => null}>
        <meshStandardMaterial color="#0b130d" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} raycast={() => null}>
        <cylinderGeometry args={[0.12, 0.16, 1.8, 8]} />
        <meshStandardMaterial color="#1a140f" roughness={1} />
      </instancedMesh>
      {/* hills */}
      {[
        [120, -2, -220, 110],
        [-140, -2, -240, 140],
        [220, -2, 60, 120],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.22, 1]} raycast={() => null}>
          <sphereGeometry args={[r, 48, 16]} />
          <meshBasicMaterial color="#05080b" />
        </mesh>
      ))}
    </group>
  )
}

/** Shallow puddles: near-mirror patches that catch the sodium lamps and the headlights. */
function Puddles() {
  const shapes = useMemo(() => {
    let s = 5
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 9 }, () => ({
      x: -9 + r() * 12.5,
      z: -16 + r() * 26,
      sx: 0.5 + r() * 1.2,
      sz: 0.35 + r() * 0.8,
      rot: r() * Math.PI,
    }))
  }, [])
  const geo = useMemo(() => {
    // irregular blob outline
    const sh = new THREE.Shape()
    const n = 28
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      const rr = 1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7)
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr
      if (i === 0) sh.moveTo(x, y)
      else sh.lineTo(x, y)
    }
    return new THREE.ShapeGeometry(sh, 4)
  }, [])
  return (
    <group>
      {shapes.map((p, i) => (
        <mesh key={i} geometry={geo} position={[p.x, 0.006, p.z]} rotation={[-Math.PI / 2, 0, p.rot]} scale={[p.sx, p.sz, 1]} receiveShadow>
          <meshPhysicalMaterial color="#202226" roughness={0.1} metalness={0.3} clearcoat={1} clearcoatRoughness={0.05} transparent opacity={0.7} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  )
}

/** Dust and insects drifting through the lamp light. */
function Motes() {
  const pts = useRef<THREE.Points>(null)
  const { geo, base } = useMemo(() => {
    const n = 900
    const p = new Float32Array(n * 3)
    let s = 9
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      const lamp = LAMP_ZS[i % LAMP_ZS.length]
      const a = r() * Math.PI * 2
      const rad = Math.sqrt(r()) * 3.2
      p[i * 3] = 2.45 + Math.cos(a) * rad
      p[i * 3 + 1] = 0.3 + r() * 8.3
      p[i * 3 + 2] = lamp + Math.sin(a) * rad
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return { geo: g, base: p.slice() }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < a.count; i++) {
      a.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.3 + i) * 0.25,
        base[i * 3 + 1] + Math.sin(t * 0.2 + i * 1.7) * 0.3,
        base[i * 3 + 2] + Math.cos(t * 0.25 + i * 0.7) * 0.25,
      )
    }
    a.needsUpdate = true
  })
  return (
    <points ref={pts} geometry={geo} raycast={() => null}>
      <pointsMaterial color="#ffcf9a" size={0.035} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

export default function NightWorld() {
  const asphalt = useMemo(() => makeAsphalt(10, 3), [])
  const shoulder = useMemo(() => makeAsphalt(6, 9), [])
  const grass = useMemo(() => makeGrass(24), [])
  const lines = useMemo(() => {
    const t = makeRoadLines()
    t.repeat.set(1, 18)
    return t
  }, [])
  const lineMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    // nothing animated here yet (the truck is parked); kept for later scenes
  })
  return (
    <group>
      <Sky />
      <Silhouettes />
      {/* ground: scrub everywhere, then the road and the lay-by on top */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial {...grass} color="#9aa58f" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-7.1, 0.0, 0]} receiveShadow>
        <planeGeometry args={[7.8, 160]} />
        <meshStandardMaterial {...asphalt} color="#d8d8d8" roughness={0.78} metalness={0.08} normalScale={new THREE.Vector2(0.8, 0.8)} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-7.1, 0.004, 0]}>
        <planeGeometry args={[7.6, 160]} />
        <meshStandardMaterial ref={lineMat} map={lines} transparent roughness={0.5} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0.4, 0.002, -2]} receiveShadow>
        <planeGeometry args={[7.2, 60]} />
        <meshStandardMaterial {...shoulder} color="#bdbab4" roughness={0.85} metalness={0.06} />
      </mesh>
      {/* kerbs: road edge and the barrier side, alternating paint */}
      {Array.from({ length: 40 }, (_, i) => (
        <mesh key={i} position={[4.1, 0.08, -32 + i * 1.5 + 0.75]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.16, 1.48]} />
          <meshStandardMaterial color={i % 2 ? '#d9d6cc' : '#1b1c1e'} roughness={0.8} />
        </mesh>
      ))}
      <Barrier />
      <Puddles />
      {!quality.low && <Motes />}
      {LAMP_ZS.map((z, i) => (
        <StreetLamp key={z} z={z} shadow={!quality.low && i === 1} />
      ))}
      <Cone position={[1.9, 0, 6.2]} />
      <Cone position={[1.2, 0, 7.4]} />
      <Cone position={[0.4, 0, 8.6]} />
    </group>
  )
}
