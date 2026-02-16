import Sidebar from '@/components/sidebar';
import TopNav from '@/components/TopNav';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden" suppressHydrationWarning>
            <Sidebar user={session} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopNav user={session} />
                <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
