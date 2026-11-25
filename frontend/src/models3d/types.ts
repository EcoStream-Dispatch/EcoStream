/*
 * Types for the Blender-built 3D models (frontend/public/models).
 * Pipeline: Blender scripts (models/blender) -> GLB + <id>.meta.json -> meshopt GLB + low LOD
 * -> manifest.json -> ModelViewer (three.js / React Three Fiber).
 */

export type Vec3 = [number, number, number]

/** One part of a model (one named node in the GLB). */
export interface ModelPart {
  id: string
  label: string
  description: string
  group: string
  /** Assembly order: 1 goes on first, so it comes off last. */
  order: number
  /** Explode direction (glTF, Y-up) and distance in metres. 0 = doesn't move on its own. */
  explode: Vec3
  distance: number
  /** Where the info marker sits (glTF coordinates, metres). */
  hotspot: Vec3
  /** Our own hardware: shown only as a closed shell, never opened or exploded. */
  sealed?: boolean
  /** Sub-mesh that belongs to another part (clicking it selects that part). */
  partOf?: string
}

export interface ModelAnimation {
  id: string
  label: string
  node: string
  /** rotate = keeps turning (wheel spin); hinge = swings between 0 and maxAngle (door, tipper). */
  type: 'rotate' | 'hinge'
  axis: Vec3
  pivot: Vec3
  speed?: number
  maxAngle?: number
}

export interface ModelMeta {
  id: string
  title: string
  description: string
  units: 'metres'
  up: 'Y'
  root: string
  parts: ModelPart[]
  animations?: ModelAnimation[]
  camera?: { position: Vec3; target: Vec3; minDistance: number; maxDistance: number }
  /** Height of the ground under the model (for the soft contact shadow), metres. */
  ground?: number
  shadowScale?: number
}

export interface ManifestModel {
  id: string
  title: string
  description: string
  files: { high: { url: string; bytes: number }; low: { url: string; bytes: number }; meta: string }
}

export interface Manifest {
  version: number
  compression: string
  totalBytes: number
  models: ManifestModel[]
}
