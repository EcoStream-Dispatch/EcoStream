import * as THREE from 'three'

/*
 * Road grime for the truck's materials, added in the shader (no extra textures):
 * a dusty brown film that rises from the ground, thickest near the wheels and the bottom
 * of the panels, broken up by world-space noise so it doesn't look like a gradient.
 */
const NOISE = /* glsl */ `
  float gHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float gNoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gHash(i + vec3(0,0,0)), gHash(i + vec3(1,0,0)), f.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), f.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float gFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * gNoise(p); p *= 2.03; a *= 0.5; } return s; }
`

export function addGrime(mat: THREE.MeshStandardMaterial, amount = 1, height = 1.3) {
  if (mat.userData.grime) return
  mat.userData.grime = true
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrime = { value: amount }
    sh.uniforms.uGrimeH = { value: height }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vGW;\nuniform float uGrime;\nuniform float uGrimeH;\n${NOISE}`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float gN = gFbm(vGW * vec3(3.0, 5.0, 3.0));
        float gStreak = gFbm(vec3(vGW.x * 9.0, vGW.y * 1.2, vGW.z * 9.0));
        float gH = 1.0 - smoothstep(0.0, uGrimeH, vGW.y + (gN - 0.5) * 0.6);
        float gK = clamp(gH * (0.55 + 0.6 * gN) + gStreak * 0.18 - 0.08, 0.0, 1.0) * uGrime;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.30, 0.23) * (0.7 + 0.5 * gN), gK * 0.75);
        roughnessFactor = mix(roughnessFactor, 0.95, gK);`,
      )
  }
  mat.customProgramCacheKey = () => `grime-${amount}-${height}`
  mat.needsUpdate = true
}
