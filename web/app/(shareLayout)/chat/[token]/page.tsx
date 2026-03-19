'use client'
import * as React from 'react'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Cookies from 'js-cookie'

const ChatRedirect = () => {
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string

  useEffect(() => {
    const customToken = Cookies.get('custom_chat_token')
    if (!customToken) {
      // If not logged in, go to the custom login page
      // We can also pass the redirect URL to return here after login if needed
      router.replace('/custom-chat/login')
    } else {
      // If already logged in, go to the new custom chat page for this bot
      router.replace(`/custom-chat/chat/${token}`)
    }
  }, [router, token])

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-[#499187] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#607d79] font-medium">正在跳转至智能助手...</p>
      </div>
    </div>
  )
}

export default React.memo(ChatRedirect)
