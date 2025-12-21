export interface Client {
    id: string
    name: string
    email?: string
    phone?: string
    company?: string
    status: 'active' | 'inactive' | 'lead'
    notes?: string
    createdAt: Date
    updatedAt: Date
    userId: string
}
