'use client'

import React, { createContext, useContext, useState } from 'react'

interface QuickCaptureContextType {
    isOpen: boolean
    onOpen: () => void
    onClose: () => void
}

const QuickCaptureContext = createContext<QuickCaptureContextType | undefined>(undefined)

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    const onOpen = () => setIsOpen(true)
    const onClose = () => setIsOpen(false)

    return (
        <QuickCaptureContext.Provider value={{ isOpen, onOpen, onClose }}>
            {children}
        </QuickCaptureContext.Provider>
    )
}

export function useQuickCapture() {
    const context = useContext(QuickCaptureContext)
    if (context === undefined) {
        throw new Error('useQuickCapture must be used within a QuickCaptureProvider')
    }
    return context
}
