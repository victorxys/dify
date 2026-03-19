'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ChatFallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the default specified chatbot
    router.replace('/custom-chat/chat/gPpLXmhHhOLqyNYV')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)] custom-chat-theme">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-[#499187] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#607d79] font-medium">正在跳转至对话...</p>
      </div>
    </div>
  )
}
