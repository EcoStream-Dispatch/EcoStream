import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ease, story } from './store'

/*
 * "ECOSTREAM" forming out of light particles, floating in front of the camera.
 * The letters are drawn once on a hidden canvas (Montserrat, like the brand), sampled
 * into points, and each point flies from a random start to its letter.
 * ECO ends green and STREAM ends navy, as in the logo. Scrolling scatters them upwards.
 * The real, readable heading is HTML (Landing3D) - this is decoration.
 */

const DIST = 7 // metres in front of the camera

const vertex = /* glsl */ `
  attribute vec3 aStart;
  attribute float aRand;
  attribute vec3 aColor;
  uniform float uProgress;
  uniform float uScatter;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float p = clamp(uProgress * 1.5 - aRand * 0.5, 0.0, 1.0);
    p = p * p * (3.0 - 2.0 * p);
    vec3 pos = mix(aStart, position, p);
    // gentle shimmer once settled
    pos.y += sin(uTime * 2.0 + aRand * 40.0) * 0.006 * p;
    // scroll: drift up and apart like embers
    float s = uScatter;
    pos += vec3((aRand - 0.5) * 7.0, 1.5 + aRand * 5.0, (fract(aRand * 7.31) - 0.5) * 5.0) * s * s;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + (1.0 - p) * 1.8) / -mv.z;
    // warm sparkle while flying, brand colour when settled
    vColor = mix(vec3(1.0, 0.86, 0.55), aColor, p);
    vAlpha = (0.3 + 0.7 * p) * (1.0 - s);
  }
`

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.32, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
    #include <colorspace_fragment>
  }
`

interface Sampled {
  target: Float32Array
  start: Float32Array
  rand: Float32Array
  color: Float32Array
  count: number
}

/** Sample the word into points (after the brand font has loaded). */
function sampleWord(widthWorld: number, step: number): Sampled {
  const c = document.createElement('canvas')
  const W = 1600
  const H = 260
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.font = '800 200px Montserrat, Arial, sans-serif'
  g.textBaseline = 'middle'
  const eco = 'ECO'
  const word = 'ECOSTREAM'
  const total = g.measureText(word).width
  const ecoW = g.measureText(eco).width
  const x0 = (W - total) / 2
  g.fillStyle = '#fff'
  g.fillText(word, x0, H / 2 + 8)
  const data = g.getImageData(0, 0, W, H).data

  const green = new THREE.Color('#5C9A35').convertSRGBToLinear()
  const navy = new THREE.Color('#0B1E36').convertSRGBToLinear()
  const pts: number[] = []
  const cols: number[] = []
  const scale = widthWorld / total
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        pts.push((x - W / 2) * scale, (H / 2 - y) * scale, 0)
        const col = x - x0 < ecoW ? green : navy
        cols.push(col.r, col.g, col.b)
      }
    }
  }
  const count = pts.length / 3
  const start = new Float32Array(count * 3)
  const rand = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // start in a wide cloud, mostly below and to the sides (as if rising off the road)
    const a = Math.random() * Math.PI * 2
    const r = 4 + Math.random() * 7
    start[i * 3] = Math.cos(a) * r
    start[i * 3 + 1] = -3 - Math.random() * 4
    start[i * 3 + 2] = Math.sin(a) * r * 0.6
    rand[i] = Math.random()
  }
  return { target: new Float32Array(pts), start, rand, color: new Float32Array(cols), count }
}

export default function Wordmark({ startAt }: { startAt: number | null }) {
  const { camera, size, gl } = useThree()
  const group = useRef<THREE.Group>(null)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    let alive = true
    ;(document.fonts?.ready ?? Promise.resolve()).then(() => alive && setFontsReady(true))
    return () => {
      alive = false
    }
  }, [])

  // Word width: fit the screen at DIST, never wider than 7.5 m.
  const fov = (camera as THREE.PerspectiveCamera).fov
  const visH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const visW = visH * (size.width / size.height)
  const widthWorld = Math.min(visW * 0.84, 5.8)

  const sampled = useMemo(
    () => (fontsReady ? sampleWord(widthWorld, story.lowPower ? 5 : 3) : null),
    [fontsReady, widthWorld],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uProgress: { value: 0 },
          uScatter: { value: 0 },
          uTime: { value: 0 },
          uSize: { value: 26 },
          uPixelRatio: { value: 1 },
        },
      }),
    [],
  )

  const fwd = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    // Stay in front of the camera, in the upper part of the screen
    camera.getWorldDirection(fwd)
    up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    const yOff = visH * (size.width < 640 ? 0.3 : 0.31)
    g.position.copy(camera.position).addScaledVector(fwd, DIST).addScaledVector(up, yOff)
    g.quaternion.copy(camera.quaternion)

    const now = state.clock.elapsedTime
    const u = material.uniforms
    u.uTime.value = now
    u.uPixelRatio.value = gl.getPixelRatio()
    u.uSize.value = (size.width < 640 ? 22 : 30) * (widthWorld / 7.2 + 0.2)
    u.uProgress.value = startAt === null ? 0 : Math.min(1, (now - startAt) / 2.8)
    u.uScatter.value = ease(story.progress.hero, 0.04, 0.4)
    g.visible = u.uScatter.value < 0.999
  })

  if (!sampled) return null
  return (
    <group ref={group} renderOrder={10}>
      <points material={material} frustumCulled={false} renderOrder={10}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sampled.target, 3]} />
          <bufferAttribute attach="attributes-aStart" args={[sampled.start, 3]} />
          <bufferAttribute attach="attributes-aRand" args={[sampled.rand, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[sampled.color, 3]} />
        </bufferGeometry>
      </points>
    </group>
  )
}
