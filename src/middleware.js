import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Paths that require authentication
// We can use the matcher config, but also check here for fine-grained control if needed
const PROTECTED_PATHS = ['/dashboard', '/settings'];

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // 1. Check if the current path is protected
    const isProtected = PROTECTED_PATHS.some(path => pathname.startsWith(path));

    if (isProtected) {
        const token = request.cookies.get('token')?.value;

        // 2. No token? Redirect to login
        if (!token) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('from', pathname);
            return NextResponse.redirect(loginUrl);
        }

        try {
            // 3. Verify Token securely on Edge
            const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');

            if (secret.length === 0) {
                console.error('CRITICAL: JWT_SECRET is missing in middleware environment!');
                // Fail open or closed? Closed is safer.
                throw new Error('JWT_SECRET missing');
            }

            await jwtVerify(token, secret);

            // Token is valid
            return NextResponse.next();

        } catch (error) {
            console.error('Middleware Auth Error:', error.message);

            // 4. Invalid Token? Redirect to login (and maybe clear cookie?)
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('error', 'session_expired');

            const response = NextResponse.redirect(loginUrl);

            // Optional: Clear the invalid cookie
            response.cookies.delete('token');

            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    // Optimization: Only run middleware on these paths
    matcher: [
        '/dashboard/:path*',
        '/settings/:path*'
    ],
};
