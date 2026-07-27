import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // The password format is 'username:password' encoded in Base64
  // Below, 'admin' and 'trading2026' are the credentials. 
  // You can change 'trading2026' to whatever you want.
  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === 'admin' && pwd === 'trading2026') {
      return NextResponse.next();
    }
  }

  // If no password or wrong password, show the login prompt
  url.pathname = '/api/auth';
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Dashboard"' }
  });
}

// Only protect the main dashboard page, leave APIs alone for now
export const config = {
  matcher: ['/'],
};