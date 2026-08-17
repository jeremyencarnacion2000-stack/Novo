'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { CognitiveGraphEdge, CognitiveGraphNode } from '@/lib/cognitive-graph/types'

type GraphMode = 'explore' | 'focus' | 'why'

type Props = {
  nodes: CognitiveGraphNode[]
  edges: CognitiveGraphEdge[]
  selectedId: string | null
  onSelectNode: (id: string) => void
  mode?: GraphMode
  highlightNodeIds?: string[]
}

type NodeVisual = {
  group: THREE.Group
  sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
}

type EdgeVisual = {
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
}

const CLUSTER_COLORS: Record<string, number> = {
  core: 0xf1efe4,
  context: 0x8f9c95,
  intent: 0x98c68f,
  evidence: 0x7d8f86,
  learning: 0xb7d8b7,
  adaptation: 0x9ed0c2,
  outcome: 0xe4d9a7,
}

const FALLBACK_COLOR = 0x94a39a

function scalePosition(position: { x: number; y: number; z?: number } | undefined) {
  const point = position ?? { x: 0.5, y: 0.5, z: 0 }
  return {
    x: (point.x - 0.5) * 5.3,
    y: (point.y - 0.5) * -4.35,
    z: (point.z ?? 0) * 1.35,
  }
}

function kindSize(node: CognitiveGraphNode) {
  if (node.kind === 'twin') return 0.24
  if (node.kind === 'strategy' || node.kind === 'pattern') return 0.16
  if (node.kind === 'memory' || node.kind === 'outcome') return 0.14
  return node.relevance > 0.78 ? 0.13 : 0.105
}

function clusterColor(node: CognitiveGraphNode) {
  return CLUSTER_COLORS[node.cluster || 'context'] || FALLBACK_COLOR
}

function colorHex(node: CognitiveGraphNode) {
  return `#${clusterColor(node).toString(16).padStart(6, '0')}`
}

function fallbackPosition(node: CognitiveGraphNode) {
  const position = node.position ?? { x: 0.5, y: 0.5 }
  return { x: position.x * 100, y: position.y * 100 }
}

function buildNeighborSet(nodes: CognitiveGraphNode[], edges: CognitiveGraphEdge[], selectedId: string | null) {
  if (!selectedId) return new Set<string>()
  const set = new Set<string>([selectedId])
  for (const edge of edges) {
    if (edge.source === selectedId) set.add(edge.target)
    if (edge.target === selectedId) set.add(edge.source)
  }
  for (const node of nodes) {
    if (node.evidenceIds.some((id) => id === selectedId)) set.add(node.id)
  }
  return set
}

export function TwinBrainMap({ nodes, edges, selectedId, onSelectNode, mode = 'focus', highlightNodeIds = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rootRef = useRef<THREE.Group | null>(null)
  const nodeVisualsRef = useRef(new Map<string, NodeVisual>())
  const edgeVisualsRef = useRef(new Map<string, EdgeVisual>())
  const rotationRef = useRef({ x: -0.14, y: 0.18 })
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  const [webgl, setWebgl] = useState(false)

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId])
  const neighborIds = useMemo(() => buildNeighborSet(nodes, edges, selectedId), [nodes, edges, selectedId])
  const spotlightIds = useMemo(() => {
    const set = new Set<string>()
    if (mode !== 'explore') {
      neighborIds.forEach((id) => set.add(id))
      highlightNodeIds.forEach((id) => set.add(id))
    }
    if (selectedNode) set.add(selectedNode.id)
    return set
  }, [highlightNodeIds, mode, neighborIds, selectedNode])

  const relatedChips = useMemo(() => {
    const active = new Set<string>()
    if (mode === 'why') {
      highlightNodeIds.forEach((id) => active.add(id))
      if (selectedNode) active.add(selectedNode.id)
    } else if (selectedId) {
      neighborIds.forEach((id) => active.add(id))
    }
    const pool = nodes.filter((node) => active.has(node.id) || (mode === 'explore' && (node.kind === 'memory' || node.kind === 'pattern' || node.kind === 'strategy' || node.kind === 'outcome')))
    return pool
      .sort((a, b) => b.relevance - a.relevance || a.label.localeCompare(b.label))
      .slice(0, mode === 'explore' ? 6 : 8)
  }, [highlightNodeIds, mode, neighborIds, nodes, selectedId, selectedNode])

  function updateVisualState() {
    const nodeVisuals = nodeVisualsRef.current
    const edgeVisuals = edgeVisualsRef.current
    const selected = selectedId
    const selectedSet = new Set<string>()
    if (selected) selectedSet.add(selected)
    if (mode !== 'explore') {
      neighborIds.forEach((id) => selectedSet.add(id))
      highlightNodeIds.forEach((id) => selectedSet.add(id))
    }

    for (const node of nodes) {
      const visual = nodeVisuals.get(node.id)
      if (!visual) continue
      const { group, sphere, halo } = visual
      const position = scalePosition(node.position)
      group.position.set(position.x, position.y, position.z)

      const isSelected = node.id === selected
      const isSpotlight = selectedSet.has(node.id)
      const isPrimary = node.kind === 'twin' || node.relevance >= 0.78
      const isSecondary = node.kind === 'memory' || node.kind === 'pattern' || node.kind === 'strategy' || node.kind === 'outcome'
      const baseSize = kindSize(node)
      const scale = isSelected ? 1.5 : isSpotlight ? 1.14 : isPrimary ? 1.03 : 0.84

      group.scale.setScalar(scale)
      sphere.material.color.setHex(clusterColor(node))
      sphere.material.opacity = node.isExcluded ? 0.2 : isSelected ? 1 : isSpotlight ? 0.94 : mode === 'explore' ? (isSecondary ? 0.84 : 0.72) : 0.16
      sphere.material.emissive.setHex(isSelected ? 0x16311f : isSpotlight ? 0x0f2417 : 0x04100a)
      sphere.material.emissiveIntensity = isSelected ? 0.45 : isSpotlight ? 0.22 : 0.08
      sphere.scale.setScalar(baseSize / kindSize(node))

      halo.material.color.setHex(isSelected ? 0xf5f0dc : clusterColor(node))
      halo.material.opacity = isSelected ? 0.32 : isSpotlight ? 0.16 : 0.05
      halo.scale.setScalar(isSelected ? 1.42 : isSpotlight ? 1.18 : 1.05)
    }

    for (const edge of edges) {
      const visual = edgeVisuals.get(edge.id)
      if (!visual) continue
      const connected = !selected || edge.source === selected || edge.target === selected
      const spotlight = selectedSet.has(edge.source) || selectedSet.has(edge.target)
      visual.line.material.opacity = isNaN(visual.line.material.opacity) ? 0.2 : visual.line.material.opacity
      visual.line.material.color.setHex(spotlight ? 0xb5d7b8 : edge.isInferred ? 0x74817c : 0x8d9b95)
      visual.line.material.opacity = connected ? (spotlight ? 0.42 : 0.22) : mode === 'explore' ? 0.14 : 0.04
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !window.WebGLRenderingContext) {
      setWebgl(false)
      return
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      setWebgl(false)
      return
    }

    setWebgl(true)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100)
    camera.position.z = 5.4
    cameraRef.current = camera

    const ambient = new THREE.AmbientLight(0xe8efe2, 1.18)
    const keyLight = new THREE.DirectionalLight(0xcfe7d1, 1.5)
    keyLight.position.set(2.6, 3.8, 5.5)
    const fillLight = new THREE.DirectionalLight(0x8fa993, 0.7)
    fillLight.position.set(-2.2, -0.6, 3.8)
    scene.add(ambient, keyLight, fillLight)
    scene.fog = new THREE.Fog(0x07110d, 5.5, 9.8)

    const root = new THREE.Group()
    scene.add(root)

    nodeVisualsRef.current.clear()
    edgeVisualsRef.current.clear()

    for (const edge of edges) {
      const source = nodes.find((node) => node.id === edge.source)
      const target = nodes.find((node) => node.id === edge.target)
      if (!source?.position || !target?.position) continue
      const start = scalePosition(source.position)
      const end = scalePosition(target.position)
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, start.z),
        new THREE.Vector3(end.x, end.y, end.z),
      ])
      const material = new THREE.LineBasicMaterial({ color: edge.isInferred ? 0x6c7a75 : 0x94a39a, transparent: true, opacity: edge.isInferred ? 0.12 : 0.22 })
      const line = new THREE.Line(geometry, material)
      line.userData.edgeId = edge.id
      root.add(line)
      edgeVisualsRef.current.set(edge.id, { line })
    }

    for (const node of nodes) {
      if (!node.position) continue
      const visualGroup = new THREE.Group()
      visualGroup.userData.nodeId = node.id
      const baseSize = kindSize(node)
      const color = clusterColor(node)

      const haloGeometry = new THREE.SphereGeometry(baseSize * 1.55, 16, 16)
      const haloMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, depthWrite: false })
      const halo = new THREE.Mesh(haloGeometry, haloMaterial)
      halo.scale.setScalar(1.05)
      visualGroup.add(halo)

      const sphereGeometry = new THREE.SphereGeometry(baseSize, 20, 20)
      const sphereMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.48,
        metalness: 0.08,
        transparent: true,
        opacity: 0.86,
      })
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
      visualGroup.add(sphere)

      const position = scalePosition(node.position)
      visualGroup.position.set(position.x, position.y, position.z)
      root.add(visualGroup)
      nodeVisualsRef.current.set(node.id, { group: visualGroup, sphere, halo })
    }

    sceneRef.current = scene
    rootRef.current = root
    rendererRef.current = renderer

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let frame = 0

    const resize = () => {
      const width = canvas.clientWidth || 1
      const height = canvas.clientHeight || 1
      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false)
        camera.aspect = width / Math.max(height, 1)
        camera.updateProjectionMatrix()
      }
    }

    const render = () => {
      frame = window.requestAnimationFrame(render)
      resize()
      const t = performance.now() * 0.001
      root.rotation.set(
        rotationRef.current.x + (reduceMotion ? 0 : Math.sin(t * 0.18) * 0.016),
        rotationRef.current.y + (reduceMotion ? 0 : Math.cos(t * 0.14) * 0.018),
        reduceMotion ? 0 : Math.sin(t * 0.11) * 0.01,
      )
      renderer.render(scene, camera)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    render()

    const selectFromCanvas = (event: MouseEvent) => {
      if (movedRef.current) {
        movedRef.current = false
        return
      }
      const bounds = canvas.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(root.children, true).find((item) => typeof item.object.userData.nodeId === 'string')
      if (hit) onSelectNode(hit.object.userData.nodeId as string)
    }

    canvas.addEventListener('click', selectFromCanvas)

    return () => {
      window.cancelAnimationFrame(frame)
      canvas.removeEventListener('click', selectFromCanvas)
      observer.disconnect()
      scene.traverse((item) => {
        const mesh = item as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose())
        } else {
          material?.dispose?.()
        }
      })
      renderer.dispose()
      nodeVisualsRef.current.clear()
      edgeVisualsRef.current.clear()
      rootRef.current = null
      sceneRef.current = null
      rendererRef.current = null
      cameraRef.current = null
    }
  }, [edges, nodes, onSelectNode])

  useEffect(() => {
    updateVisualState()
  }, [edges, highlightNodeIds, mode, neighborIds, nodes, selectedId, selectedNode])

  return (
    <div className="overflow-hidden rounded-[28px] border border-foreground/10 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_58%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="relative">
        <canvas
          ref={canvasRef}
          data-testid="twin-brain-webgl"
          aria-label="Cerebro 3D navegable del Gemelo Cognitivo"
          aria-hidden={!webgl}
          className={`relative z-10 h-[19rem] w-full touch-none transition-opacity sm:h-[24rem] lg:h-[min(52vh,32rem)] lg:min-h-[24rem] ${webgl ? 'opacity-100' : 'opacity-0'}`}
          onPointerDown={(event) => {
            movedRef.current = false
            dragRef.current = { x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return
            const dx = event.clientX - dragRef.current.x
            const dy = event.clientY - dragRef.current.y
            if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true
            dragRef.current = { x: event.clientX, y: event.clientY }
            rotationRef.current = {
              x: Math.max(-0.68, Math.min(0.68, rotationRef.current.x + dy * 0.0075)),
              y: rotationRef.current.y + dx * 0.0075,
            }
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
        />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full p-3 opacity-70 transition-opacity duration-700 sm:p-5"
          aria-hidden="true"
          data-testid="twin-brain-silhouette"
        >
          <path
            d="M50 12 C31 5 14 19 15 40 C5 50 12 72 29 76 C34 91 47 88 50 82 C53 88 66 91 71 76 C88 72 95 50 85 40 C86 19 69 5 50 12 Z"
            fill="color-mix(in srgb, var(--primary) 4%, transparent)"
            stroke="color-mix(in srgb, var(--foreground) 19%, transparent)"
            strokeDasharray="1.4 2.2"
            strokeWidth="0.62"
          />
          <path d="M50 13 C46 27 48 41 50 50 C52 61 53 71 50 82" fill="none" stroke="color-mix(in srgb, var(--foreground) 10%, transparent)" strokeDasharray="1 2.4" strokeWidth="0.42" />
          <path d="M18 44 C31 39 39 42 50 50 C61 42 69 39 82 44" fill="none" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeDasharray="1 2.4" strokeWidth="0.38" />
        </svg>
        {!webgl && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 z-10 h-full w-full p-3 sm:p-5"
            role="group"
            aria-label="Mapa navegable del cerebro del Gemelo Cognitivo"
            data-testid="twin-brain-fallback-nodes"
          >
            {edges.map((edge) => {
              const source = nodes.find((node) => node.id === edge.source)
              const target = nodes.find((node) => node.id === edge.target)
              if (!source || !target) return null
              const start = fallbackPosition(source)
              const end = fallbackPosition(target)
              return (
                <line
                  key={edge.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="color-mix(in srgb, var(--foreground) 24%, transparent)"
                  strokeWidth={edge.isInferred ? 0.35 : 0.55}
                  strokeDasharray={edge.isInferred ? '1.2 1.6' : undefined}
                />
              )
            })}
            {nodes.map((node) => {
              const point = fallbackPosition(node)
              const selected = selectedId === node.id
              const highlighted = spotlightIds.has(node.id)
              const radius = node.kind === 'twin' ? 3.8 : node.relevance > 0.78 ? 2.65 : 1.9
              return (
                <g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={node.label}
                  className="cursor-pointer outline-none"
                  onClick={() => onSelectNode(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectNode(node.id)
                    }
                  }}
                >
                  <circle cx={point.x} cy={point.y} r={radius * 1.75} fill={colorHex(node)} opacity={selected ? 0.22 : highlighted ? 0.14 : 0.07} />
                  <circle cx={point.x} cy={point.y} r={radius} fill={colorHex(node)} opacity={node.isExcluded ? 0.28 : selected ? 1 : highlighted ? 0.92 : 0.78} />
                  <circle cx={point.x} cy={point.y} r={radius + 0.7} fill="none" stroke={selected ? 'var(--primary)' : 'transparent'} strokeWidth="0.55" />
                </g>
              )
            })}
          </svg>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_42%),radial-gradient(circle_at_28%_38%,rgba(140,196,156,0.12),transparent_28%),radial-gradient(circle_at_72%_38%,rgba(140,196,156,0.12),transparent_28%)]" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 px-4 py-3 text-[10px] text-foreground/52 sm:px-5">
        <span>{webgl ? 'Arrastra para mover. Toca un nodo para enfocar.' : 'Vista accesible del aprendizaje del Twin.'}</span>
        <span>{mode === 'why' ? 'Why activo' : mode === 'explore' ? 'Explorar' : 'En foco'} · {nodes.filter((node) => node.cluster === 'learning' || node.cluster === 'adaptation').length} aprendizajes</span>
      </div>
      <div className="border-t border-foreground/10 bg-foreground/[0.015] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2">
          {relatedChips.length ? relatedChips.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${selectedId === node.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-foreground/10 text-foreground/65 hover:bg-foreground/[0.05]'}`}
            >
              {node.label}
            </button>
          )) : (
            <p className="text-[11px] text-foreground/48">Selecciona un nodo para ver su vecindario o su evidencia.</p>
          )}
        </div>
      </div>
    </div>
  )
}
