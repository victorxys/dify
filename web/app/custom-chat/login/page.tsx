'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { login } from '@/service/external-auth'
import Button from '@/app/components/base/button'
import { ToastContext, useToastContext } from '@/app/components/base/toast'
import { RiUserLine } from '@remixicon/react'

export default function LoginPage() {
  const router = useRouter()
  const { notify } = useToastContext()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !password) {
      notify({ type: 'error', message: '请输入手机号和密码' })
      return
    }

    setLoading(true)
    try {
      const res = await login(phone, password)
      if (res.access_token) {
        Cookies.set('custom_chat_token', res.access_token, { expires: 7 })
        Cookies.set('custom_chat_user', JSON.stringify(res.user), { expires: 7 })
        notify({ type: 'success', message: '登录成功' })
        router.push('/custom-chat/chat')
      } else {
        notify({ type: 'error', message: '登录验证失败，默认密码是身份证号后6位' })
      }
    } catch {
      notify({ type: 'error', message: '登录失败，默认密码是身份证号后6位' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 custom-chat-theme">
      <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="w-24 h-24 mb-4 drop-shadow-md">
          <img src="/logo-custom.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-[#1c332f]">萌姨萌嫂智能助手</h1>
      </div>

      <div className="w-full max-w-[400px] z-10">
        <div className="bg-white rounded-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#e5f2f0]">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#1c332f] mb-2 px-1">手机号</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="w-full px-4 py-3 bg-white border border-[#c0dbd6] rounded-lg focus:ring-2 focus:ring-[#499187] focus:border-[#499187] transition-all outline-none text-[#1c332f] font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1c332f] mb-2 px-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white border border-[#c0dbd6] rounded-lg focus:ring-2 focus:ring-[#499187] focus:border-[#499187] transition-all outline-none text-[#1c332f] font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#499187] hover:bg-[#3d7a71] active:translate-y-0.5 text-white rounded-lg font-bold transition-all shadow-md shadow-[#499187]/10 disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-8 text-center space-y-2">
            <p className="text-xs text-[#607d79]/60 leading-relaxed">
              登录后您将被重定向至原目的地。
            </p>
            <p className="text-[10px] text-[#607d79]/40 font-mono">
              认证成功后即可开始对话: gPpLXmhhHHOLqyNYV
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
