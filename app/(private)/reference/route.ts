import { NextResponse } from 'next/server'

// The API reference moved to the developer site (/dev/api). Old links keep
// working.
export function GET(request: Request) {
  return NextResponse.redirect(new URL('/dev/api', request.url), 308)
}
