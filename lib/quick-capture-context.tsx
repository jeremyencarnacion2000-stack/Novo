'use client'

import React, { createContext, useContext, useRef, useState } from 'react'
import { readModalOrigin } from '@/lib/modal-origin'

interface QuickCaptureContextType {
    isOpen: boolean
    onOpen: () => void
    onClose: () => void
    originRef: React.MutableRefObject<HTMLElement | null>
}

const QuickCaptureContext = createContext<QuickCaptureContextType | undefined>(undefined)

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const originRef = useRef<HTMLElement | null>(null)

    const onOpen = () => {
        // Quick Capture is split-loaded. Keep the click source across that
        // delay so the modal can still expand from, and close back to, it.
        originRef.current = readModalOrigin().element
        setIsOpen(true)
    }
    const onClose = () => setIsOpen(false)

    return (
        <QuickCaptureContext.Provider value={{ isOpen, onOpen, onClose, originRef }}>
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
