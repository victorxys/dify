import type { Metadata } from 'next'
import './theme.css'

export const metadata: Metadata = {
  title: '萌嫂AI | 智能助手',
  description: '您的暖心生活助手',
  icons: {
    icon: '/logo-custom.png',
  },
}

export default function CustomChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] custom-chat-theme">
      {children}
    </div>
  )
}
