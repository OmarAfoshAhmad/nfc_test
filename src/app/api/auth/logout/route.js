import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logAudit } from '@/lib/audit';

export async function POST(request) {
    const cookieStore = await cookies();
    cookieStore.delete('token');

    await logAudit({
        action: 'LOGOUT',
        entity: 'auth',
        details: { status: 'success' },
        req: request
    });

    return NextResponse.json({ message: 'Logged out' });
}
