/**
 * CANONICAL DOMAIN REDIRECT
 * 
 * Ensures all traffic on Production uses canonical domain (unbreak-one.com)
 * - Redirects *.vercel.app → unbreak-one.com (301 permanent)
 * - Preserves full URL path and query params
 * - Only active in PRODUCTION environment
 * - Allows preview deployments to work normally
 * 
 * Environment detection:
 * - Production: VERCEL_ENV === 'production'
 * - Preview: VERCEL_ENV === 'preview'
 * - Development: VERCEL_ENV === 'development' or local
 */

import { NextResponse } from 'next/server';

export function middleware(request) {
  // Only run on production environment
  const isProduction = process.env.VERCEL_ENV === 'production';
  
  if (!isProduction) {
    // Allow preview deployments and development to work normally
    return NextResponse.next();
  }
  
  const url = request.nextUrl.clone();
  const hostname = url.hostname;
  const canonicalDomain = process.env.NEXT_PUBLIC_SITE_URL || 'https://unbreak-one.com';
  const canonicalHostname = new URL(canonicalDomain).hostname;
  
  // Check if current hostname is NOT the canonical domain
  if (hostname !== canonicalHostname && hostname.includes('vercel.app')) {
    // Build redirect URL with canonical domain
    url.hostname = canonicalHostname;
    url.protocol = 'https:';
    
    // 301 Permanent Redirect
    return NextResponse.redirect(url, {
      status: 301,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }
  
  // Add canonical header to all responses
  const response = NextResponse.next();
  const canonicalUrl = `${canonicalDomain}${url.pathname}${url.search}`;
  response.headers.set('Link', `<${canonicalUrl}>; rel="canonical"`);
  
  return response;
}

// Apply middleware to all routes except:
// - Static files (_next/static, images, etc.)
// - API routes (they need to accept requests from any origin)
// - Webhook routes (external services need stable URLs)
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     * - api routes (need to accept from any origin)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|api).*)',
  ],
};
