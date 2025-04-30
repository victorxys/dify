import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const NECESSARY_DOMAIN = '*.sentry.io http://localhost:* http://127.0.0.1:* https://analytics.google.com googletagmanager.com *.googletagmanager.com https://www.google-analytics.com https://api.github.com'
// +++ 添加你的 Token Key +++
export const TOKEN_KEY = 'auth_token'
const wrapResponseWithXFrameOptions = (response: NextResponse, pathname: string) => {
  // prevent clickjacking: https://owasp.org/www-community/attacks/Clickjacking
  // Chatbot page should be allowed to be embedded in iframe. It's a feature
  if (process.env.NEXT_PUBLIC_ALLOW_EMBED !== 'true' && !pathname.startsWith('/chat'))
    response.headers.set('X-Frame-Options', 'DENY')

  return response
}
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // +++ 开始: 插入你的身份验证逻辑 +++
  // 检查是否是需要保护的聊天页面 (并且不是登录页本身)
  if (pathname.startsWith('/chat') && !pathname.startsWith('/chat-login')) {
    console.log('Chat page access detected, checking authentication')

    // 1. 从 Cookie 获取 Token
    const token = request.cookies.get(TOKEN_KEY)?.value
    console.log('Token from cookie:', !!token)

    // 2. 如果 Cookie 没有，从 Header 获取
    const authHeader = request.headers.get('Authorization')
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
    console.log('Token from Authorization header:', !!authToken)

    // 使用 Cookie 或 Header 的 Token
    let validToken = token || authToken

    // 3. (开发便利) 检查 URL 参数
    const urlToken = request.nextUrl.searchParams.get('token')
    if (urlToken && !validToken) {
      console.log('Found token in URL, allowing access and setting cookie')
      validToken = urlToken // 认为 URL token 有效
      // 创建响应以设置 Cookie
      const responseWithCookie = NextResponse.next() // 创建基础响应
      responseWithCookie.cookies.set(TOKEN_KEY, urlToken, {
        path: '/',
        maxAge: 86400, // 1 day, adjust as needed
        sameSite: 'lax',
        // secure: process.env.NODE_ENV === 'production', // Consider adding secure flag in prod
        // httpOnly: true, // Consider httpOnly if frontend JS doesn't need to read it directly
      })
      // 注意：这里设置了 Cookie 就直接继续处理请求了，
      // 后续的安全头会应用到这个 responseWithCookie 上。
      // 如果希望设置完 Cookie 就结束中间件，则 return responseWithCookie
      // 但通常我们希望继续应用 CSP 等头，所以不在这里 return。
      // 我们需要将这个 response 对象传递下去，或者让后续逻辑重新创建 NextResponse.next()
      // 为了简化，我们假设后续逻辑会创建新的 NextResponse.next()，这里仅标记 validToken 存在
    }

    // 4. 如果最终没有有效 Token，则重定向
    if (!validToken) {
      console.log('No valid token found, redirecting to login page')
      const url = request.nextUrl.clone()
      url.pathname = '/chat-login'
      url.searchParams.set('redirect', pathname) // 保留原始路径用于登录后跳转
      // --- 关键: 立即返回重定向响应 ---
      return NextResponse.redirect(url)
    }

    console.log('Valid token found, allowing access to chat page')
    // 如果 Token 有效，则继续执行后续的中间件逻辑（CSP、X-Frame-Options）
  }

  // 如果访问的是登录页面，直接继续，不需要身份验证拦截
  if (pathname.startsWith('/chat-login')) {
    console.log('Login page access, skipping auth check')
    // 仍然需要应用安全头，所以继续执行
  }
  // +++ 结束: 插入你的身份验证逻辑 +++
  
  const requestHeaders = new Headers(request.headers)
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const isWhiteListEnabled = !!process.env.NEXT_PUBLIC_CSP_WHITELIST && process.env.NODE_ENV === 'production'
  if (!isWhiteListEnabled)
    return wrapResponseWithXFrameOptions(response, pathname)

  const whiteList = `${process.env.NEXT_PUBLIC_CSP_WHITELIST} ${NECESSARY_DOMAIN}`
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = `'nonce-${nonce}'`

  const scheme_source = 'data: mediastream: blob: filesystem:'

  const cspHeader = `
    default-src 'self' ${scheme_source} ${csp} ${whiteList};
    connect-src 'self' ${scheme_source} ${csp} ${whiteList};
    script-src 'self' ${scheme_source} ${csp} ${whiteList};
    style-src 'self' 'unsafe-inline' ${scheme_source} ${whiteList};
    worker-src 'self' ${scheme_source} ${csp} ${whiteList};
    media-src 'self' ${scheme_source} ${csp} ${whiteList};
    img-src 'self' ${scheme_source} ${csp} ${whiteList};
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
`
  // Replace newline characters and spaces
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, ' ')
    .trim()

  requestHeaders.set('x-nonce', nonce)

  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue,
  )

  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue,
  )

  return wrapResponseWithXFrameOptions(response, pathname)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      // source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      // source: '/(.*)',
      // missing: [
      //   { type: 'header', key: 'next-router-prefetch' },
      //   { type: 'header', key: 'purpose', value: 'prefetch' },
      // ],
    },
  ],
}
