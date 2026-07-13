'use client'

// WebGL hero visual — a real 3D "constellation" of the Cognitive Twin's
// graph. Deliberately built with vanilla three.js driven imperatively from
// a plain useEffect, NOT @react-three/fiber: fiber's react-reconciler is
// the most likely cause of a previous production incident where this hero
// corrupted React's module singleton app-wide ("Cannot read properties of
// undefined (reading 'ReactCurrentBatchConfig')" on every page, not just
// this one). Vanilla three.js never touches React internals — it just
// paints a canvas — which removes that entire class of bug at the root
// instead of hoping a different bundler config avoids it.
//
// Lazy-loaded only for the landing hero (see app/landing/page.tsx) via
// next/dynamic({ ssr: false }) so the rest of the marketing page never
// waits on the 3D chunk, and so this module (which touches `window` at
// setup time) never runs during SSR.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Node = {
  id: string
  pos: [number, number, number]
  r: number
  color: number
}

const NODES: Node[] = [
  { id: 'root', pos: [0, 0, 0], r: 0.5, color: 0xffffff },
  { id: 'identity', pos: [-1.7, 0.9, 0.5], r: 0.3, color: 0x818cf8 },
  { id: 'energy', pos: [1.8, 0.75, -0.35], r: 0.3, color: 0xfbbf24 },
  { id: 'signal', pos: [-1.4, -1.15, -0.6], r: 0.26, color: 0x34d399 },
  { id: 'bottleneck', pos: [1.55, -1.05, 0.55], r: 0.28, color: 0xfb7185 },
  { id: 'metric', pos: [0.1, -1.75, 0.15], r: 0.22, color: 0x60a5fa },
]

export default function HeroGraph3D() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 5.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    container.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.4))
    const point = new THREE.PointLight(0x8b8bff, 40)
    point.position.set(3, 3, 4)
    scene.add(point)

    const group = new THREE.Group()
    scene.add(group)

    // Edges — root to every other node.
    const root = NODES[0]
    const edgePositions: number[] = []
    for (const n of NODES.slice(1)) edgePositions.push(...root.pos, ...n.pos)
    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3))
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial))

    // Nodes — low-poly emissive spheres, same kind/color language as the
    // real in-app graph (components/cognitive/cognitive-graph-view.tsx).
    const meshes = NODES.map((n) => {
      const geometry = new THREE.SphereGeometry(n.r, 24, 24)
      const material = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: n.color,
        emissiveIntensity: n.id === 'root' ? 0.6 : 1.1,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...n.pos)
      group.add(mesh)
      return mesh
    })

    const pointer = { x: 0, y: 0, active: false }
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      pointer.active = true
    }
    const handlePointerLeave = () => { pointer.active = false }
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

    // Drag-to-rotate — grabbing the twin and flicking it spins the whole
    // graph freely instead of just nudging it toward the cursor.
    const drag = { active: false, lastX: 0, lastY: 0, velY: 0, velX: 0 }
    const handlePointerDown = (e: PointerEvent) => {
      drag.active = true
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      container.style.cursor = 'grabbing'
    }
    const handlePointerDrag = (e: PointerEvent) => {
      if (!drag.active) return
      const dx = e.clientX - drag.lastX
      const dy = e.clientY - drag.lastY
      drag.velY = dx * 0.005
      drag.velX = dy * 0.005
      group.rotation.y += drag.velY
      group.rotation.x += drag.velX
      drag.lastX = e.clientX
      drag.lastY = e.clientY
    }
    const handlePointerUp = () => {
      drag.active = false
      container.style.cursor = 'grab'
    }
    container.style.cursor = 'grab'
    container.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerDrag)
    window.addEventListener('pointerup', handlePointerUp)

    // Scroll reactivity — how far the hero has scrolled past nudges the
    // twin's tilt and a slow extra spin, so it feels tied to the page.
    let scrollProgress = 0
    const handleScroll = () => {
      const rect = container.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // 0 when hero is centered in viewport, grows toward 1 as it scrolls away.
      scrollProgress = THREE.MathUtils.clamp(1 - (rect.top + rect.height / 2) / vh, -1, 1)
    }
    const scrollParent = container.closest('.custom-scrollbar') as HTMLElement | null
    const scrollTarget: HTMLElement | Window = scrollParent ?? window
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true } as any)
    handleScroll()

    let rafId: number
    const clock = new THREE.Clock()
    let residualSpin = 0

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const t = clock.getElapsedTime()

      if (!reducedMotion) {
        meshes.forEach((mesh, i) => {
          const scale = 1 + Math.sin(t * 1.2 + i * 1.4) * 0.06
          mesh.scale.setScalar(scale)
        })
      }

      // Residual spin momentum after a drag release, decaying over time.
      if (!drag.active) {
        residualSpin = THREE.MathUtils.lerp(residualSpin, 0, 0.08)
        if (Math.abs(drag.velY) > 0.0001) {
          residualSpin = drag.velY
          drag.velY *= 0.9
        }
      }

      if (!reducedMotion) {
        if (!drag.active) {
          group.rotation.y += delta * 0.15 + residualSpin * 0.3
        }
        if (pointer.active && !drag.active) {
          group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.y * 0.2 + scrollProgress * 0.35, 0.04)
          group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, pointer.x * -0.12, 0.04)
        } else if (!drag.active) {
          group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, scrollProgress * 0.35, 0.04)
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      container.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerDrag)
      window.removeEventListener('pointerup', handlePointerUp)
      scrollTarget.removeEventListener('scroll', handleScroll as any)
      meshes.forEach((mesh) => {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      })
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="relative w-full aspect-square max-w-[440px] mx-auto">
      <div
        className="absolute inset-0 rounded-full blur-[90px] opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
      />
      <div ref={containerRef} className="relative w-full h-full" />
    </div>
  )
}
