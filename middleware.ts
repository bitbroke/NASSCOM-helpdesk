import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Simple in-memory fallback for local development when Upstash credentials are not configured
const memoryCache = new Map<string, { count: number; resetTime: number }>();

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/api/process-ticket' &&
    request.method === 'POST'
  ) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      try {
        const redis = new Redis({ url, token });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, '60 s'),
          analytics: true,
          prefix: '@upstash/ratelimit',
        });
        const { success } = await ratelimit.limit(ip);
        if (!success) {
          return new NextResponse(
            JSON.stringify({ error: 'Too many requests. Limit is 5 tickets per minute.' }),
            { status: 429, headers: { 'content-type': 'application/json' } }
          );
        }
        return NextResponse.next();
      } catch (err) {
        console.error('Rate limiting error, falling back to memory:', err);
      }
    }

    // Fallback: In-memory rate limiting
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const limit = 5;

    const record = memoryCache.get(ip);
    if (!record || now > record.resetTime) {
      memoryCache.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      record.count += 1;
      if (record.count > limit) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Limit is 5 tickets per minute.' }),
          { status: 429, headers: { 'content-type': 'application/json' } }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
