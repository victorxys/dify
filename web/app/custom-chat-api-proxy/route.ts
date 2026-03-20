import { type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const apiKey = process.env.NEXT_PUBLIC_CUSTOM_CHAT_DIFY_API_KEY
  const apiPrefix = process.env.CONSOLE_API_URL || 'http://api:5001'

  const response = await fetch(`${apiPrefix}/v1/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const apiKey = process.env.NEXT_PUBLIC_CUSTOM_CHAT_DIFY_API_KEY
  const apiPrefix = process.env.CONSOLE_API_URL || 'http://api:5001'
  
  const path = request.nextUrl.pathname.replace('/api/custom-chat-proxy', '')
  const targetUrl = `${apiPrefix}/v1${path}?${searchParams.toString()}`

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
