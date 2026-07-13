'use client'

import React from 'react'
import { ModernChatbot } from './index'

interface MobileChatSheetProps {
    onClose: () => void
}

// Two resting states, not one: DEFAULT leaves the mobile nav bar visible
// below the sheet (the reference the user pointed to — "el nav bar siempre
// esta ahi"), EXPANDED covers the whole screen including the nav bar. A drag
// handle at the sheet's own bottom edge (not its top — matching "una linea
// pequeña en la parte inferior") toggles between them; dragging down past
// threshold from DEFAULT closes the sheet entirely via the same flip-close
// used everywhere else.
const DEFAULT_BOTTOM = 96 // px — clears the nav bar (bottom-4 + its own height)
const EXPANDED_BOTTOM = 0

export function MobileChatSheet({ onClose }: MobileChatSheetProps) {
    const [expanded, setExpanded] = React.useState(false)
    const [dragY, setDragY] = React.useState(0)
    const [dragging, setDragging] = React.useState(false)
    const dragStartY = React.useRef(0)

    const handleDragStart = (e: React.PointerEvent) => {
        dragStartY.current = e.clientY
        setDragging(true)
        ;(e.target as Element).setPointerCapture(e.pointerId)
    }
    const handleDragMove = (e: React.PointerEvent) => {
        if (!dragging) return
        setDragY(e.clientY - dragStartY.current)
    }
    const handleDragEnd = () => {
        setDragging(false)
        // Dragging the handle up (negative dragY) grows the sheet toward/over
        // the nav bar; dragging down shrinks it back, or dismisses if it was
        // already at the default (nav-bar-visible) size.
        if (!expanded && dragY < -40) setExpanded(true)
        else if (!expanded && dragY > 60) onClose()
        else if (expanded && dragY > 40) setExpanded(false)
        setDragY(0)
    }

    const restingBottom = expanded ? EXPANDED_BOTTOM : DEFAULT_BOTTOM
    // While actively dragging, follow the finger (clamped so it can't go
    // past fully-expanded); otherwise sit at the current snap point.
    const bottom = dragging ? Math.max(EXPANDED_BOTTOM, restingBottom - dragY) : restingBottom
    const bottomStyle: React.CSSProperties = {
        bottom,
        transition: dragging ? 'none' : 'bottom 0.32s cubic-bezier(0.25,1,0.5,1)',
    }

    return (
        <>
            <div
                data-flip-overlay="mobile-ai-panel"
                className="modal-flip-overlay fixed top-0 left-0 right-0 z-[5000] bg-black/70 md:hidden"
                style={bottomStyle}
            />
            <div
                data-flip-to="mobile-ai-panel"
                className="modal-flip-target fixed top-0 left-0 right-0 z-[5001] rounded-b-[32px] overflow-hidden md:hidden flex flex-col"
                style={bottomStyle}
            >
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ModernChatbot onMobileClose={onClose} />
                </div>

                {/* Handle — the "curvatura que delimita" boundary. Drag up to
                    expand over the nav bar, down to reveal it again / dismiss. */}
                <div
                    className="flex-shrink-0 flex justify-center py-2 bg-black cursor-grab active:cursor-grabbing touch-none"
                    onPointerDown={handleDragStart}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                >
                    <div className="w-9 h-[3px] rounded-full bg-white/20" />
                </div>
            </div>
        </>
    )
}
