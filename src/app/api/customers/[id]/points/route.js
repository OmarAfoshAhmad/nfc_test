import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logPoints } from '@/lib/loyalty';

export async function POST(request, { params }) {
    // Unwrap params 
    // In API routes in Next.js 15, params is a Promise. In 14/earlier it's an object.
    // We'll await it just in case or treat as object if not.
    const { id } = await Promise.resolve(params);

    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { points, reason } = body;

        if (!points || !reason) {
            return NextResponse.json({ message: 'Points and Reason are required' }, { status: 400 });
        }

        await logPoints({
            customer_id: id,
            points: parseInt(points),
            reason: reason,
            admin_id: session.id
        });

        return NextResponse.json({ message: 'Points updated successfully' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
