import ky from 'ky'
import Cookies from 'js-cookie'

const getApiPrefix = () => {
  return '/custom-chat-api-proxy'
}

const getApiKey = () => {
  return process.env.NEXT_PUBLIC_CUSTOM_CHAT_DIFY_API_KEY || ''
}

const getEndUserId = () => {
  const userCookie = Cookies.get('custom_chat_user')
  try {
    if (userCookie) {
      const user = JSON.parse(userCookie)
      return user.id || user.phone || 'custom-chat-user'
    }
  } catch {
    // console.error('Failed to parse user cookie', e)
  }
  return 'custom-chat-user'
}

export const sendChatMessage = async (
  query: string, 
  conversationId: string | null = null, 
  onMessage: (chunk: string) => void,
  onConversationId?: (id: string) => void,
  files: Record<string, any>[] = [],
  onSuggestions?: (suggestions: string[]) => void,
  onMessageEnd?: (messageId: string) => void
) => {
  const response = await fetch(`${getApiPrefix()}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: 'streaming',
      conversation_id: conversationId || '',
      user: getEndUserId(),
      files: files || []
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Dify API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    })
    throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${errorBody}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  
  if (!reader) return

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // Keep the last partial line in the buffer
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.slice(5))
          
          if (data.event === 'message' || data.event === 'agent_message') {
            onMessage(data.answer)
            // Early ID extraction: tell the UI as soon as we have a conversation ID
            if (data.conversation_id && onConversationId) {
              onConversationId(data.conversation_id)
            }
          }
          
          if (data.event === 'message_end' || data.event === 'workflow_finished') {
            if (data.conversation_id && onConversationId) {
              onConversationId(data.conversation_id)
            }
            if (data.message_id && onMessageEnd) {
              onMessageEnd(data.message_id)
            }
            if (data.metadata?.suggested_questions && onSuggestions) {
              onSuggestions(data.metadata.suggested_questions)
            }
          }
        } catch {
          // Incomplete JSON or other error, buffer will handle it
        }
      }
    }
  }
}

export const fetchConversations = async (limit: number = 20) => {
  return await ky.get(`${getApiPrefix()}/conversations`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    searchParams: {
      user: getEndUserId(),
      limit,
    }
  }).json<Record<string, any>>()
}

export const fetchMessages = async (conversationId: string) => {
  return await ky.get(`${getApiPrefix()}/messages`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    searchParams: {
      user: getEndUserId(),
      conversation_id: conversationId,
    }
  }).json<Record<string, any>>()
}

export const fetchAppParameters = async () => {
  return await ky.get(`${getApiPrefix()}/parameters`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    searchParams: {
      user: getEndUserId(),
    }
  }).json<Record<string, any>>()
}

export const uploadFile = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('user', getEndUserId())

  return await ky.post(`${getApiPrefix()}/files/upload`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: formData,
  }).json<Record<string, any>>()
}

export const getSuggestedQuestions = async (messageId: string) => {
  return await ky.get(`${getApiPrefix()}/messages/${messageId}/suggested`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    searchParams: {
      user: getEndUserId(),
    }
  }).json<Record<string, any>>()
}
