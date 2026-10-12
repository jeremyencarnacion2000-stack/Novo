export type RefractivePriority = 'critical' | 'interactive' | 'ambient'

type Lease = {
  id: string
  priority: RefractivePriority
  order: number
}

const priorityWeight: Record<RefractivePriority, number> = {
  critical: 3,
  interactive: 2,
  ambient: 1,
}

/**
 * Priority-aware lease manager for the expensive same-document SVG filters.
 * Surfaces remain mounted when they lose a lease; only their optical layer
 * falls back to CSS, so pre-emption never causes a layout or paint flash.
 */
export class LiquidGlassBudget {
  private readonly leases = new Map<string, Lease>()
  private readonly listeners = new Set<() => void>()
  private order = 0

  constructor(private readonly limit = 5) {}

  request(id: string, priority: RefractivePriority) {
    const current = this.leases.get(id)
    if (current?.priority === priority) return this.isGranted(id)

    this.leases.set(id, {
      id,
      priority,
      order: current?.order ?? this.order++,
    })
    this.emit()
    return this.isGranted(id)
  }

  release(id: string) {
    if (!this.leases.delete(id)) return
    this.emit()
  }

  isGranted(id: string) {
    return this.grantedIds().includes(id)
  }

  grantedIds() {
    return [...this.leases.values()]
      .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || a.order - b.order)
      .slice(0, this.limit)
      .map((lease) => lease.id)
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }
}

export const liquidGlassBudget = new LiquidGlassBudget(5)
