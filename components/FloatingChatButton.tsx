import { MessageCircle } from 'lucide-react'

interface FloatingChatButtonProps {
  isOpen: boolean
  onToggle: () => void
}

export function FloatingChatButton({ isOpen, onToggle }: FloatingChatButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-4 right-4 w-12 h-12 bg-[#5A67D8] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200 z-50"
      aria-label="Toggle chat"
    >
      <MessageCircle size={24} />
    </button>
  )
}