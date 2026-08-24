import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const handleI18n = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Capture supabase cookie updates to apply to any response
  const cookieUpdates: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookieUpdates.push(
            ...cookiesToSet.map(({ name, value, options }) => ({ name, value, options }))
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Apply collected cookie updates to any response we return
  function withCookies(res: NextResponse): NextResponse {
    cookieUpdates.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.cookies.set(name, value, options as any)
    })
    return res
  }

  // Strip locale prefix for auth path matching
  const cleanPath = pathname.replace(/^\/(tr|en|de)(?=\/|$)/, '') || '/'
  const pathLocale = pathname.match(/^\/(en|de)(?=\/|$)/)?.[1] ?? 'tr'
  const localePrefix = pathLocale === 'tr' ? '' : `/${pathLocale}`

  // Unauthenticated → redirect to login
  if (!user && (cleanPath.startsWith('/admin') || cleanPath.startsWith('/resident'))) {
    return withCookies(
      NextResponse.redirect(new URL(`${localePrefix}/login`, request.url))
    )
  }

  // Logged-in user at login → redirect to dashboard
  if (user && cleanPath === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const dest = profile?.role === 'admin' ? '/admin' : `${localePrefix}/resident`
    return withCookies(NextResponse.redirect(new URL(dest, request.url)))
  }

  // Non-admin accessing /admin → send to resident portal
  if (user && cleanPath.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return withCookies(
        NextResponse.redirect(new URL(`${localePrefix}/resident`, request.url))
      )
    }
    // Admin OK — no i18n needed for admin routes
    return withCookies(NextResponse.next({ request }))
  }

  // Admin routes (authenticated admin) skip i18n
  if (pathname.startsWith('/admin')) {
    return withCookies(NextResponse.next({ request }))
  }

  // All other routes: apply i18n middleware
  return withCookies(handleI18n(request))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
