import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ease, story } from './store'

/*
 * Finale: a roadside tyre garage the truck pulls up to at sunrise.
 * Name is the demo name used in the app ("Sample Tyre Works"), drawn on a canvas.
 */

export const GARAGE_POS = new THREE.Vector3(9.2, 0, -1.5)

function useSign() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 200
    const g = c.getContext('2d')!
    g.fillStyle = '#3E7231'
    g.fillRect(0, 0, 1024, 200)
    g.fillStyle = '#ffffff'
    g.font = '800 76px Montserrat, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('SAMPLE TYRE WORKS', 512, 86)
    g.font = '600 34px Inter, Arial, sans-serif'
    g.fillStyle = '#d9f0c8'
    g.fillText('Open 24×7 · Verified', 512, 160)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
}

export default function Garage() {
  const sign = useSign()
  const ref = useRef<THREE.Group>(null)
  const tyre = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.9 }), [])
  useFrame(() => {
    const show = ease(story.progress.finale, 0.3, 0.55)
    if (!ref.current) return
    ref.current.visible = show > 0.001
    ref.current.position.set(GARAGE_POS.x, GARAGE_POS.y - (1 - show) * 6, GARAGE_POS.z)
  })
  return (
    <group ref={ref} visible={false} rotation={[0, -Math.PI / 2, 0]}>
      {/* concrete apron */}
      <mesh position={[0, 0.03, 2.6]} receiveShadow>
        <boxGeometry args={[10, 0.06, 5]} />
        <meshStandardMaterial color="#d8d2c4" roughness={0.95} />
      </mesh>
      {/* building */}
      <RoundedBox args={[8.5, 4.2, 4.5]} radius={0.12} position={[0, 2.1, -1.6]} castShadow receiveShadow>
        <meshStandardMaterial color="#F4F1E8" roughness={0.8} />
      </RoundedBox>
      {/* open bay */}
      <mesh position={[0, 1.7, 0.66]}>
        <planeGeometry args={[4.2, 3.3]} />
        <meshStandardMaterial color="#2a3036" roughness={0.9} />
      </mesh>
      {/* roof + sign */}
      <RoundedBox args={[9.2, 0.35, 5.4]} radius={0.1} position={[0, 4.35, -1.4]} castShadow>
        <meshStandardMaterial color="#0B1E36" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 5.2, 0.9]}>
        <planeGeometry args={[6.4, 1.25]} />
        <meshStandardMaterial map={sign} roughness={0.5} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.25} />
      </mesh>
      {/* stack of tyres by the door */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[3.3, 0.22 + i * 0.36, 1.2]} rotation={[Math.PI / 2, 0, 0]} material={tyre} castShadow>
          <torusGeometry args={[0.45, 0.17, 12, 28]} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={i} position={[-3.4, 0.62, 1.4 + i * 0.05]} rotation={[0, Math.PI / 2 + i * 0.2, 0]} material={tyre} castShadow>
          <torusGeometry args={[0.45, 0.17, 12, 28]} />
        </mesh>
      ))}
    </group>
  )
}
