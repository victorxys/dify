'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function CustomChatIndex() {
  const router = useRouter()

  useEffect(() => {
    const token = Cookies.get('custom_chat_token')
    if (token)
      router.replace('/custom-chat/chat')
    else
      router.replace('/custom-chat/login')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  )
}
