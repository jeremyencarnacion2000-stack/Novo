import fs from 'node:fs'
import path from 'node:path'

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), ...file.split('/')), 'utf8')

describe('native modal motion unification', () => {
  it('delegates contextual modal motion to the shared dialog controller', () => {
    const content = source('components/ui/contextual-modal.tsx')

    expect(content).toContain('motionPreset="anchored"')
    expect(content).not.toContain('gsap.fromTo')
    expect(content).not.toContain('document.querySelector')
  })

  it('integrates the new motionId shared-element lifecycle into Dialog', () => {
    const dialog = source('components/ui/dialog.tsx')
    const sharedController = source('hooks/use-shared-dialog-motion.ts')

    expect(dialog).toContain('useSharedDialogMotion')
    expect(dialog).toContain('motionId?: string')
    expect(dialog).toContain('enabled: isIntegratedFlipModal')
    expect(sharedController).toContain('modalFlip.toggle(motionId)')
    expect(sharedController).toContain('modalFlip.untoggle(motionId, onComplete)')
    expect(sharedController).toContain('modalFlip.cancel(motionId)')
    const sharedFlip = source('lib/modal-flip.ts')
    expect(sharedFlip).toContain('const { origin, target, overlay } = findPair(id)')
    expect(sharedFlip).toContain("origin?.classList.remove('modal-flip-source-active')")
  })

  it('keeps sheet motion in the shared GSAP controller rather than Tailwind keyframes', () => {
    const content = source('components/ui/sheet.tsx')

    expect(content).toContain('useNativeDialogMotion')
    expect(content).not.toContain('slide-in-from-')
    expect(content).not.toContain('slide-out-to-')
    expect(content).not.toContain('data-[state=open]:animate-in')
  })

  it('uses the alert preset for confirmations', () => {
    const content = source('components/ui/alert-dialog.tsx')

    expect(content).toContain('useNativeDialogMotion')
    expect(content).toContain("preset: 'alert'")
    expect(content).not.toContain('zoom-in-95')
  })

  it('defines one modal token set and tactile trigger feedback', () => {
    const content = source('app/globals.css')

    expect(content).toContain('--novo-modal-ease-enter: cubic-bezier(0.23, 1, 0.32, 1)')
    expect(content).toContain('--novo-modal-ease-move: cubic-bezier(0.77, 0, 0.175, 1)')
    expect(content).toContain('--novo-modal-ease-sheet: cubic-bezier(0.32, 0.72, 0, 1)')
    expect(content).toContain('[data-flip-from]:active')
    expect(content).toContain('transform: scale(0.97)')
    expect(content).toContain('120ms var(--novo-modal-ease-enter)')
  })

  it('does not layer browser View Transitions over modal lifecycles', () => {
    const settings = source('components/settings/settings-modal.tsx')
    const sidebar = source('components/app-sidebar.tsx')
    const routinesPage = source('app/routines/page.tsx')

    expect(settings).not.toContain('safeViewTransition')
    expect(settings).not.toContain('viewTransitionName')
    expect(sidebar).not.toContain('safeViewTransition')
    expect(sidebar).not.toContain('viewTransitionName')
    expect(routinesPage).not.toContain('safeViewTransition')
  })

  it('routes former hand-built modal overlays through the shared primitives', () => {
    const calendar = source('app/calendar/page.tsx')
    const music = source('app/music/page.tsx')
    const connectors = source('components/ai/modern-chatbot/connectors-modal.tsx')

    expect(calendar).not.toContain('fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in')
    expect(calendar).toContain('motionId="btn-create-event"')
    expect(calendar).not.toContain('modalFlip.toggle')
    expect(calendar).not.toContain('modalFlip.untoggle')
    expect(music).toContain('motionPreset="center"')
    expect(connectors).toContain('mobilePresentation="sheet"')
    expect(connectors).not.toContain('<AnimatePresence>')
  })

  it('does not double-run the paywall shared transition', () => {
    const paywall = source('components/billing/novo-paywall.tsx')

    expect(paywall).toContain('motionId="novo-paywall"')
    expect(paywall).not.toContain("import { modalFlip } from '@/lib/modal-flip'")
    expect(paywall).not.toContain("modalFlip.toggle('novo-paywall')")
    expect(paywall).not.toContain("modalFlip.untoggle('novo-paywall'")
  })

  it('keeps Quick Capture on the command preset without a parallel portal animator', () => {
    const quickCapture = source('components/quick-capture.tsx')

    expect(quickCapture).toContain('motionPreset="command"')
    expect(quickCapture).toContain('mobilePresentation="sheet"')
    expect(quickCapture).not.toContain('createPortal')
    expect(quickCapture).not.toContain('<AnimatePresence>')
    expect(quickCapture).not.toContain('useDragToDismiss')
  })

  it('uses the shared sheet primitive for chat conversation history', () => {
    const chat = source('components/ai/modern-chatbot/index.tsx')

    expect(chat).toContain('<Sheet open={isDrawerOpen}')
    expect(chat).toContain('side="left"')
    expect(chat).not.toContain('data-testid="conversation-history-backdrop"')
    expect(chat).not.toContain("initial={{ x: '-100%' }}")
  })

  it('routes chat tools and document previews through the shared modal primitives', () => {
    const chatInput = source('components/ai/modern-chatbot/chat-input.tsx')
    const documentViewer = source('components/ai/modern-chatbot/blocks/document-viewer.tsx')

    expect(chatInput).toContain('motionPreset="command"')
    expect(chatInput).toContain('mobilePresentation="sheet"')
    expect(chatInput).not.toContain('createPortal')
    expect(chatInput).not.toContain('sm:zoom-in-95')
    expect(documentViewer).toContain('<Sheet open')
    expect(documentViewer).toContain('<SheetContent')
    expect(documentViewer).not.toContain('createPortal')
    expect(documentViewer).not.toContain('transition-transform duration-300')
  })

  it('uses an anchored desktop surface and a mobile sheet for the voice hub', () => {
    const dashboardShell = source('components/dashboard-shell.tsx')

    expect(dashboardShell).toContain('motionPreset="anchored"')
    expect(dashboardShell).toContain('mobilePresentation="sheet"')
    expect(dashboardShell).not.toContain('<AnimatePresence>')
    expect(dashboardShell).not.toContain("initial={{ opacity: 0, y: 16, scale: 0.95 }}")
  })

  it('keeps secondary app surfaces on the shared modal primitives', () => {
    const notifications = source('components/notification-center.tsx')
    const mobileNav = source('components/mobile-section-drawer.tsx')
    const calendar = source('app/calendar/page.tsx')
    const player = source('components/music/now-playing-fullscreen.tsx')
    const workout = source('components/routines/active-workout-session.tsx')
    const mobileChat = source('components/ai/modern-chatbot/mobile-chat-sheet.tsx')

    expect(notifications).toContain('<Dialog')
    expect(notifications).toContain('motionPreset="anchored"')
    expect(notifications).toContain('motionId="notifications"')
    expect(notifications).toContain('data-flip-from="notifications"')
    expect(notifications).not.toContain('createPortal')
    expect(notifications).not.toContain('useDragToDismiss')

    expect(mobileNav).toContain('motionId="mobile-nav-panel"')
    expect(mobileNav).toContain('<Dialog')
    expect(mobileNav).not.toContain('useDragToDismiss')
    expect(calendar).toContain('<Sheet open={showMobileSidebar}')
    expect(calendar).not.toContain("showMobileSidebar ? 'fixed inset-0")

    expect(player).toContain('<Sheet open={open}')
    expect(player).not.toContain('<AnimatePresence>')
    expect(workout).toContain('motionPreset="fullscreen"')
    expect(workout).not.toContain('initial={{ opacity: 0, y: \'100%\'')
    expect(mobileChat).toContain('motionId="mobile-ai-panel"')
    expect(mobileChat).not.toContain('data-flip-overlay="mobile-ai-panel"')
  })
})
