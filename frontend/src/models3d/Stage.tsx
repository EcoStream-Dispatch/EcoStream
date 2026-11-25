import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { ContactShadows, MeshReflectorMaterial } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { ModelMeta } from './types'

/*
 * Product-shot "studio" for the 3D models: dark backdrop, soft image-based light, a warm key light,
 * cool rim lights, a glossy reflective floor that fades into fog, and post effects
 * (ambient occlusion, bloom for LEDs, AgX tone mapping, vignette, fine film grain).
 * `fx` = false (phones / Light detail): same lights, no reflections or post effects.
 */

export const STAGE_BG = '#0a0e13'

function StudioEnvironment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])
  return null
}

export default function Stage({ meta, fx }: { meta: ModelMeta; fx: boolean }) {
  // scale the rig to the model: the wheel is ~1 m, the truck ~9 m
  const S = (meta.camera?.maxDistance ?? 4) / 4
  const ground = meta.ground ?? 0
  const floor = (meta.shadowScale ?? 4) * 5
  return (
    <>
      <color attach="background" args={[STAGE_BG]} />
      <fog attach="fog" args={[STAGE_BG, 2.2 * S, 6.5 * S]} />
      <StudioEnvironment intensity={0.55} />
      <ambientLight intensity={0.05} />
      {/* warm key from the front-left, soft shadows */}
      <spotLight
        position={[2.2 * S, 3.2 * S, 2.6 * S]}
        angle={0.55}
        penumbra={0.9}
        intensity={60 * S * S}
        decay={2}
        color="#ffe2c2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      {/* cool rim lights from behind: the bright edges that shape the silhouette */}
      <directionalLight position={[-3 * S, 2 * S, -3.5 * S]} intensity={2.2} color="#9cc8ff" />
      <directionalLight position={[3.5 * S, 1 * S, -2.5 * S]} intensity={1.2} color="#b9f5a0" />
      {/* low fill so blacks keep a little detail */}
      <directionalLight position={[0, -1, 3 * S]} intensity={0.25} color="#ffffff" />

      {fx ? (
        <mesh rotation-x={-Math.PI / 2} position={[0, ground - 0.001, 0]} receiveShadow>
          <planeGeometry args={[floor, floor]} />
          <MeshReflectorMaterial
            blur={[400, 120]}
            resolution={1024}
            mixBlur={1}
            mixStrength={1.4}
            roughness={0.9}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            color="#10151b"
            metalness={0.55}
            mirror={0.5}
          />
        </mesh>
      ) : (
        <mesh rotation-x={-Math.PI / 2} position={[0, ground - 0.001, 0]} receiveShadow>
          <planeGeometry args={[floor, floor]} />
          <meshStandardMaterial color="#10151b" roughness={0.85} metalness={0.2} />
        </mesh>
      )}
      <ContactShadows position={[0, ground, 0]} opacity={0.75} scale={meta.shadowScale ?? 4} blur={2.2} far={2 * S} color="#000000" />

      {fx && (
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.35 * S} distanceFalloff={0.6 * S} intensity={2.4} halfRes />
          <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.85} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Vignette offset={0.28} darkness={0.75} />
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.18} />
        </EffectComposer>
      )}
    </>
  )
}
