import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import createIntlMiddleware from 'next-intl/middleware'

// i18n middleware
const intlMiddleware = createIntlMiddleware({
  locales: ['ko', 'en', 'es', 'ja', 'fr', 'pt', 'de'],
  defaultLocale: 'ko',
  localePrefix: 'always',
  localeDetection: true
})

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal or static files (but not YouTube URL paths like /https:/www.youtube.com/...)
  const isEmbeddedUrl = pathname.match(/^\/(ko|en|es|ja|fr|pt|de)?\/?https?:/) || pathname.match(/^\/https?:/);
  if (
    !isEmbeddedUrl && (
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/auth/callback') ||
      pathname === '/favicon.ico' ||
      pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|mjs|js|css)$/)
    )
  ) {
    return NextResponse.next();
  }

  // Update Supabase auth session
  const { supabaseResponse } = await updateSession(request)

  // Skip root page - let client-side handle redirect
  if (pathname === '/') {
    return supabaseResponse;
  }

  // Run i18n handling
  const intlResponse = intlMiddleware(request)

  // Merge cookies from supabase response into intl response
  supabaseResponse.cookies.getAll().forEach(cookie => {
    intlResponse.cookies.set(cookie.name, cookie.value)
  })

  return intlResponse
}

export const config = {
  matcher: [
    // Match all routes except:
    // - API routes (/api/...)
    // - Static files (/_next/static, /favicon.ico, etc.)
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
};
