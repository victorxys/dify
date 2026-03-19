'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Cookies from 'js-cookie'
import {
  RiSendPlane2Line,
  RiHistoryFill,
  RiAddLargeFill,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiUserLine,
  RiLogoutBoxRLine,
  RiAttachment2,
  RiCloseLine,
  RiArrowRightSLine
} from '@remixicon/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  fetchConversations,
  fetchMessages,
  sendChatMessage,
  fetchAppParameters,
  uploadFile,
  getSuggestedQuestions
} from '@/service/custom-chat'
import { cn } from '@/utils/classnames'

const MessageContent = ({ content, isUser }: { content: string, isUser: boolean }) => {
  const [isThoughtOpen, setIsThoughtOpen] = useState(false)
  
  if (isUser) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    )
  }

  // Parse think block
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/)
  const thinkContent = thinkMatch ? thinkMatch[1].trim() : null
  const mainContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim()

  return (
    <div className="flex flex-col w-full space-y-2">
      {thinkContent && (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--background)]">
          <button 
            onClick={() => setIsThoughtOpen(!isThoughtOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
          >
            <RiArrowRightSLine 
              size={14} 
              className={cn("transition-transform duration-200", isThoughtOpen ? "rotate-90" : "")} 
            />
            思考过程
          </button>
          {isThoughtOpen && (
            <div className="px-3 py-2 text-[13px] text-[var(--muted-foreground)] border-t border-[var(--border)] max-h-96 overflow-y-auto custom-scrollbar prose prose-sm max-w-none prose-p:my-0.5">
               <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                 {thinkContent}
               </ReactMarkdown>
            </div>
          )}
        </div>
      )}
      {mainContent && (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {mainContent}
        </ReactMarkdown>
      )}
    </div>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const appId = params?.appId as string
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [appParams, setAppParams] = useState<any>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setIsSidebarOpen(!mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)

    const token = Cookies.get('custom_chat_token')
    const userCookie = Cookies.get('custom_chat_user')
    if (!token) {
      router.push('/custom-chat/login')
      return
    }
    if (userCookie) setUser(JSON.parse(userCookie))

    // Fetch conversation history
    loadConversations().finally(() => {
      setIsLoading(false)
    })
    loadAppParams()

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleLogout = () => {
    Cookies.remove('custom_chat_token')
    Cookies.remove('custom_chat_user')
    router.push('/custom-chat/login')
  }

  const loadAppParams = async () => {
    try {
      const data = await fetchAppParameters()
      console.log('DEBUG appParams:', JSON.stringify(data, null, 2))
      setAppParams(data)
    } catch (e) {
      console.error('Failed to load app params', e)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversations = async (newId?: string) => {
    try {
      const data = await fetchConversations()
      setConversations(data.data || [])
      if (newId) setCurrentConversationId(newId)
    } catch (error) {
      console.error('Failed to fetch conversations', error)
    }
  }

  const selectConversation = async (id: string) => {
    setCurrentConversationId(id)
    if (isMobile) setIsSidebarOpen(false)
    setMessages([])
    try {
      const data = await fetchMessages(id)
      const history = data.data.flatMap((m: any) => [
        { role: 'user', content: m.query, id: `${m.id}-user` },
        { role: 'assistant', content: m.answer, id: `${m.id}-assistant` }
      ]).filter((m: any) => m.content)
      setMessages(history)
      setSuggestedQuestions([])
    } catch (error) {
      console.error('Failed to fetch messages', error)
    }
  }

  const startNewChat = () => {
    setCurrentConversationId(null)
    setMessages([])
    setInputValue('')
    setSuggestedQuestions([])
    setSelectedFiles([])
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const res = await uploadFile(file)
      setSelectedFiles(prev => [...prev, {
        type: 'image',
        transfer_method: 'local_file',
        upload_file_id: res.id,
        url: URL.createObjectURL(file)
      }])
    } catch (e) {
      console.error('Upload failed', e)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.upload_file_id !== id))
  }

  const handleSend = async (text?: string) => {
    const messageText = typeof text === 'string' ? text : inputValue
    if (!messageText.trim() && selectedFiles.length === 0 || isTyping) return

    const userMessage = {
      role: 'user',
      content: messageText,
      files: selectedFiles.map(f => f.url)
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    const currentFiles = [...selectedFiles]
    setSelectedFiles([])
    setSuggestedQuestions([])
    setIsTyping(true)

    let assistantContent = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    let conversationIdHandled = false

    try {
      await sendChatMessage(
        messageText,
        currentConversationId,
        (chunk) => {
          assistantContent += chunk
          setMessages(prev => {
            const newMessages = [...prev]
            newMessages[newMessages.length - 1].content = assistantContent
            return newMessages
          })
        },
        (conversationId) => {
          if (!currentConversationId && !conversationIdHandled) {
            conversationIdHandled = true
            setCurrentConversationId(conversationId)

            setConversations(prev => {
              if (prev.some(c => c.id === conversationId)) return prev
              const newConv = {
                id: conversationId,
                name: messageText.slice(0, 30) + (messageText.length > 30 ? '...' : ''),
                inputs: {},
                created_at: Date.now() / 1000
              }
              return [newConv, ...prev]
            })

            setTimeout(() => loadConversations(), 2000)
          }
        },
        currentFiles.map(f => ({
          type: f.type,
          transfer_method: f.transfer_method,
          upload_file_id: f.upload_file_id
        })),
        (suggestions) => {
          setSuggestedQuestions(suggestions)
        },
        async (messageId) => {
          if (appParams?.suggested_questions_after_answer?.enabled) {
            try {
              const res = await getSuggestedQuestions(messageId)
              if (res.data && res.data.length > 0) {
                setSuggestedQuestions(res.data)
              }
            } catch (e) {
              console.error('Failed to get suggested questions', e)
            }
          }
        }
      )
    } catch (error) {
      console.error('Message send failed', error)
    } finally {
      setIsTyping(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#499187] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[#607d79] font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden font-sans custom-chat-theme relative max-w-[100vw]">
      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-[var(--sidebar)] border-[var(--sidebar-border)] flex flex-col shadow-sm transition-all duration-300 z-50",
        isMobile ? "fixed inset-y-0 left-0" : "relative border-r",
        isSidebarOpen ? (isMobile ? "w-[280px] translate-x-0" : "w-80 translate-x-0") : (isMobile ? "w-[280px] -translate-x-full" : "w-0 overflow-hidden")
      )}>
        <div className="p-6 flex items-center justify-between border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
              <img src="/logo-custom.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg text-[var(--sidebar-foreground)]">萌嫂AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-[var(--sidebar-foreground)]/60 hover:text-[var(--sidebar-primary)] transition-colors">
            <RiMenuFoldLine />
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--sidebar-primary)] hover:opacity-90 text-white rounded-xl transition-all shadow-md group"
          >
            <RiAddLargeFill size={20} className="group-hover:rotate-90 transition-transform" />
            <span className="font-semibold">开启新对话</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-bold text-[var(--sidebar-foreground)]/40 uppercase tracking-widest mb-3 px-3 flex items-center gap-2">
            <RiHistoryFill size={14} /> 最近对话
          </div>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl transition-all text-sm truncate",
                currentConversationId === conv.id
                  ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] font-medium shadow-sm ring-1 ring-[var(--sidebar-primary)]/10"
                  : "text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)]/50 hover:text-[var(--sidebar-foreground)]"
              )}
            >
              {conv.name || '未命名对话'}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-[var(--sidebar-border)] bg-[var(--sidebar)]/50">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[var(--border)] shadow-sm">
            <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white border border-white/20 shadow-sm overflow-hidden">
              <img src="/logo-custom.png" alt="User" className="w-full h-full object-contain scale-150" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-[var(--foreground)]">{user?.username || '访客'}</p>
              <button
                onClick={handleLogout}
                className="text-[10px] text-[var(--muted-foreground)] hover:text-red-500 font-bold uppercase transition-colors flex items-center gap-1"
              >
                <RiLogoutBoxRLine size={10} /> 退出登录
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-[var(--background)] min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]/50">
          <div className="w-10">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-[var(--secondary)] text-[var(--foreground)] rounded-lg transition-all"
              >
                <RiMenuUnfoldLine size={20} />
              </button>
            )}
          </div>
          <h1 className="text-sm font-semibold text-[var(--foreground)] text-center truncate absolute left-1/2 -translate-x-1/2 w-3/5">
            {currentConversationId
              ? (conversations.find(c => c.id === currentConversationId)?.name || '对话中...')
              : '萌嫂AI'}
          </h1>
          <div className="w-10"></div>
        </div>

        {/* Header Illustration */}
        {!currentConversationId && messages.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-opacity duration-1000">
            <div className="w-24 h-24 mb-6 mx-auto animate-pulse">
              <img src="/logo-custom.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-3xl font-extrabold mb-2 tracking-tight text-[var(--foreground)]">萌嫂AI助手</h2>
            <p className="text-[var(--muted-foreground)] font-medium">今天有什么可以帮您的吗？</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-4 px-4 md:px-6 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-4 pt-4">
            {/* Opening Statement */}
            {appParams?.opening_statement && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-[var(--border)] shadow-sm overflow-hidden">
                    <img src="/logo-custom.png" alt="AI" className="w-full h-full object-contain p-0.5" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--muted-foreground)]">萌嫂AI</span>
                </div>
                <div className="w-full text-[14px] leading-relaxed text-[var(--foreground)] overflow-hidden">
                  <div className="prose prose-sm max-w-none prose-p:my-0.5 text-[var(--foreground)] w-full">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {appParams.opening_statement}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, idx) => (
              <div key={idx} className={cn(
                "animate-in fade-in slide-in-from-bottom-2 duration-500 w-full",
                message.role === 'user' ? "flex justify-end" : ""
              )}>
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-[var(--border)] shadow-sm overflow-hidden">
                      <img src="/logo-custom.png" alt="AI" className="w-full h-full object-contain p-0.5" />
                    </div>
                    <span className="text-xs font-semibold text-[var(--muted-foreground)]">萌嫂AI</span>
                  </div>
                )}
                <div className={cn(
                  "text-[14px] leading-relaxed overflow-hidden",
                  message.role === 'user'
                    ? "max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-none shadow-sm bg-[var(--primary)] text-white"
                    : "w-full text-[var(--foreground)]"
                )}>
                  {message.files && message.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {message.files.map((url: string, i: number) => (
                        <div key={i} className="w-16 h-16 rounded-md overflow-hidden border border-white/20">
                          <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={cn(
                    "prose prose-sm max-w-none prose-p:my-0.5 w-full",
                    message.role === 'user' ? "text-inherit prose-invert" : "text-[var(--foreground)] prose-headings:text-[var(--foreground)]"
                  )}>
                    <MessageContent content={message.content} isUser={message.role === 'user'} />
                  </div>
                  {message.role === 'assistant' && !message.content && isTyping && (
                    <div className="flex gap-1.5 items-center py-2">
                      <div className="w-2 h-2 bg-[var(--primary)]/40 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-[var(--primary)]/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-[var(--primary)]/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="w-full px-4 md:px-6 pb-6 md:pb-10 pt-2 flex justify-center bg-gradient-to-t from-[var(--background)] via-[var(--background)]/90 to-transparent">
          <div className="w-full max-w-3xl">
            {suggestedQuestions.length > 0 && !isTyping && (
              <div className="flex flex-wrap gap-2 mb-3 animate-in fade-in slide-in-from-bottom-2">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="px-3 py-1.5 bg-white/80 hover:bg-white text-[12px] text-[var(--primary)] border border-[var(--border)] rounded-full shadow-sm transition-all whitespace-nowrap"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3 p-2 bg-white/50 rounded-2xl border border-[var(--border)]/50 backdrop-blur-sm">
                {selectedFiles.map((file) => (
                  <div key={file.upload_file_id} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
                    <img src={file.url} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFile(file.upload_file_id)}
                      className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RiCloseLine size={12} />
                    </button>
                  </div>
                ))}
                {isUploading && (
                  <div className="w-16 h-16 rounded-xl border border-dashed border-[var(--border)] flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-center text-[var(--muted-foreground)]/60 mb-2 select-none">
              萌嫂AI是人工智能，有时可能会出错
            </p>

            <div className="relative group transition-all duration-500">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--chart-2)] rounded-[26px] blur-sm opacity-10 group-focus-within:opacity-20 transition duration-500"></div>
              <div className="relative bg-white border border-[var(--border)] rounded-[24px] p-1.5 flex items-end gap-1.5 shadow-xl shadow-[var(--sidebar-ring)]/5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isTyping}
                  className="w-9 h-9 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--secondary)] rounded-full transition-all shrink-0"
                >
                  <RiAttachment2 size={18} />
                </button>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="在此输入您的问题..."
                  rows={1}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[var(--foreground)] placeholder-[var(--muted-foreground)]/60 resize-none py-2 px-1 min-h-[36px] max-h-48 outline-none text-[14px] font-medium leading-normal"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={(!inputValue.trim() && selectedFiles.length === 0) || isTyping}
                  className="w-9 h-9 bg-[var(--primary)] hover:opacity-90 disabled:opacity-30 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 text-white shrink-0"
                >
                  <RiSendPlane2Line size={16} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
