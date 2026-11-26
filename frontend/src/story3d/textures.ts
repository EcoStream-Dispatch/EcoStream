import * as THREE from 'three'

/*
 * Procedural textures (drawn on canvases at load, no downloads): asphalt with grain, patches and
 * cracks, its normal + roughness maps, painted road lines, grass and concrete.
 */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvas(n: number) {
  const c = document.createElement('canvas')
  c.width = c.height = n
  return [c, c.getContext('2d')!] as const
}

/** Height field (0..255 grey) -> tangent-space normal map. */
function heightToNormal(src: HTMLCanvasElement, strength: number) {
  const n = src.width
  const g = src.getContext('2d')!
  const h = g.getImageData(0, 0, n, n).data
  const [c, out] = canvas(n)
  const img = out.createImageData(n, n)
  const at = (x: number, y: number) => h[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * n + x) * 4
      img.data[i] = (-dx / l) * 127 + 128
      img.data[i + 1] = (dy / l) * 127 + 128
      img.data[i + 2] = (1 / l) * 127 + 128
      img.data[i + 3] = 255
    }
  out.putImageData(img, 0, 0)
  return c
}

function tex(c: HTMLCanvasElement, repeat: number, srgb: boolean) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface SurfaceMaps {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

/** Asphalt: aggregate grain, darker tar patches, a few cracks. */
export function makeAsphalt(repeat = 12, seed = 3): SurfaceMaps {
  const n = 512
  const r = rng(seed)
  const [col, g] = canvas(n)
  const [hgt, gh] = canvas(n)
  const [rough, gr] = canvas(n)
  g.fillStyle = '#2a2c2f'
  g.fillRect(0, 0, n, n)
  gh.fillStyle = '#808080'
  gh.fillRect(0, 0, n, n)
  gr.fillStyle = '#c8c8c8'
  gr.fillRect(0, 0, n, n)
  // patches (repairs, oil, wet spots: glossier)
  for (let i = 0; i < 14; i++) {
    const x = r() * n
    const y = r() * n
    const rad = 30 + r() * 90
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    const d = r() < 0.5 ? 'rgba(15,16,18,0.55)' : 'rgba(60,62,64,0.35)'
    grad.addColorStop(0, d)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    const gg = gr.createRadialGradient(x, y, 0, x, y, rad)
    gg.addColorStop(0, 'rgba(70,70,70,0.6)')
    gg.addColorStop(1, 'rgba(0,0,0,0)')
    gr.fillStyle = gg
    gr.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  // aggregate stones
  for (let i = 0; i < 26000; i++) {
    const x = r() * n
    const y = r() * n
    const s = 0.6 + r() * 1.8
    const v = 30 + r() * 70
    g.fillStyle = `rgb(${v},${v},${v + 2})`
    g.fillRect(x, y, s, s)
    const hv = 120 + r() * 120
    gh.fillStyle = `rgb(${hv},${hv},${hv})`
    gh.fillRect(x, y, s, s)
    const rv = 150 + r() * 100
    gr.fillStyle = `rgb(${rv},${rv},${rv})`
    gr.fillRect(x, y, s, s)
  }
  // cracks
  g.strokeStyle = 'rgba(8,8,9,0.8)'
  gh.strokeStyle = 'rgba(20,20,20,1)'
  for (let i = 0; i < 6; i++) {
    let x = r() * n
    let y = r() * n
    g.lineWidth = gh.lineWidth = 0.8 + r()
    g.beginPath()
    gh.beginPath()
    g.moveTo(x, y)
    gh.moveTo(x, y)
    for (let k = 0; k < 18; k++) {
      x += (r() - 0.5) * 22
      y += (r() - 0.3) * 18
      g.lineTo(x, y)
      gh.lineTo(x, y)
    }
    g.stroke()
    gh.stroke()
  }
  return {
    map: tex(col, repeat, true),
    normalMap: tex(heightToNormal(hgt, 2.2), repeat, false),
    roughnessMap: tex(rough, repeat, false),
  }
}

/** Grass / scrub at night: mottled dark green with clumps. */
export function makeGrass(repeat = 20): SurfaceMaps {
  const n = 256
  const r = rng(11)
  const [col, g] = canvas(n)
  const [hgt, gh] = canvas(n)
  g.fillStyle = '#1b2417'
  g.fillRect(0, 0, n, n)
  gh.fillStyle = '#707070'
  gh.fillRect(0, 0, n, n)
  for (let i = 0; i < 9000; i++) {
    const x = r() * n
    const y = r() * n
    const v = r()
    g.fillStyle = `rgba(${40 + v * 40},${55 + v * 50},${25 + v * 20},0.6)`
    g.fillRect(x, y, 1, 2 + r() * 3)
    gh.fillStyle = `rgba(${150 + v * 100},${150 + v * 100},${150 + v * 100},0.7)`
    gh.fillRect(x, y, 1, 2 + r() * 3)
  }
  const rough = document.createElement('canvas')
  rough.width = rough.height = 4
  const rg = rough.getContext('2d')!
  rg.fillStyle = '#f0f0f0'
  rg.fillRect(0, 0, 4, 4)
  return { map: tex(col, repeat, true), normalMap: tex(heightToNormal(hgt, 1.5), repeat, false), roughnessMap: tex(rough, 1, false) }
}

/** Painted road lines for a 2-lane road (texture across the road's width, repeating along it). */
export function makeRoadLines(): THREE.Texture {
  const w = 256
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(235,235,225,0.92)'
  // solid edge lines
  g.fillRect(6, 0, 7, h)
  g.fillRect(w - 13, 0, 7, h)
  // dashed centre
  g.fillRect(w / 2 - 3, 0, 6, h * 0.45)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Soft round glow (for lamp halos, light pools, the moon). */
export function makeGlow(color = '#ffffff'): THREE.Texture {
  const n = 128
  const [c, g] = canvas(n)
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  grad.addColorStop(0, color)
  grad.addColorStop(0.25, color + 'aa')
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, n, n)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
