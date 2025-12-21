export interface ActivityHistory {
    id: string
    action: string
    details?: string
    entityType: string
    entityId?: string
    createdAt: Date
    userId: string
}
