'use client'
import * as React from 'react'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Cookies from 'js-cookie'

const RootTokenRedirect = () => {
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string

  useEffect(() => {
    if (!token) return

    const customToken = Cookies.get('custom_chat_token')
    if (!customToken) {
      // If not logged in, go to the custom login page
      router.replace('/custom-chat/login')
    } else {
      // If already logged in, go to the new custom chat page for this bot
      // Since we don't know for sure if it's a chat or chatbot token here, 
      // we redirect to our custom chat route which handle all appIds
      router.replace(`/custom-chat/chat/${token}`)
    }
  }, [router, token])

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-[#499187] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#607d79] font-medium">正在验证身份并跳转...</p>
      </div>
    </div>
  )
}

export default React.memo(RootTokenRedirect)
