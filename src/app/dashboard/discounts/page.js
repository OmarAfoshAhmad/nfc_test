import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DiscountsClient from './client';

export default async function DiscountsPage() {
    const session = await getSession();
    const allowedRoles = ['admin', 'superadmin'];

    if (!session || !allowedRoles.includes(session.role)) {
        redirect('/dashboard');
    }

    return <DiscountsClient />;
}
