'use client';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import { LogOut, Languages, User, Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useSettings } from '@/lib/SettingsContext';
import { useState, useEffect } from 'react';

export default function TopNav({ user }) {
    const { t, language, toggleLanguage, dir } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const { settings } = useSettings();
    const router = useRouter();

    const storeName = settings.store_name || 'NFC Discount';

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.refresh();
        router.push('/login');
    };

    return (
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-500 hidden md:block">
                    {storeName}
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all active:scale-90"
                    title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {/* Language Toggle */}
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-bold border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
                >
                    <Languages size={18} />
                    <span>{language === 'ar' ? 'English' : 'العربية'}</span>
                </button>

                <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1"></div>

                {/* User Info & Logout */}
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end text-sm">
                        <span className="font-bold text-gray-700 dark:text-gray-200">{user?.username}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                            {t(user?.role || 'staff')}
                        </span>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full text-blue-600">
                        <User size={20} />
                    </div>
                    <button
                        onClick={handleLogout}
                        title={t('logout')}
                        className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-2"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </header>
    );
}
