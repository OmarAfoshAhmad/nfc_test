'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useSettings } from '@/lib/SettingsContext';
import { Settings, DollarSign, Coins, Save, Palette, Shield, Globe, Info, Activity, Upload, Loader2, Image as ImageIcon, Database } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
    const { t, language, dir } = useLanguage();
    const { refreshSettings, updateSettingsState } = useSettings();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [settings, setSettings] = useState({
        store_name: '',
        currency_symbol: '€',
        accent_color: '#3b82f6',
        enable_sounds: 'true',
        toast_duration: '3000',
        logo_url: '',
        maintenance_mode: 'false',
        expiry_warning_days: '7',
        enable_db_cleanup: 'false',
        db_cleanup_days: '10'
    });
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/settings?t=' + Date.now()).then(res => res.json()),
            fetch('/api/auth/me?t=' + Date.now()).then(res => res.json())
        ]).then(([sData, uData]) => {
            if (sData.data) setSettings(prev => ({ ...prev, ...sData.data }));
            if (uData.user) setCurrentUser(uData.user);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            toast.error(t('error_loading'));
            setLoading(false);
        });
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `logos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setSettings(prev => ({ ...prev, logo_url: publicUrl }));
            toast.success(t('upload_success'));
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(t('upload_error'));
        } finally {
            setUploading(false);
        }
    };

    const handleEmergencyRestore = async () => {
        if (!confirm(t('confirm_delete') || 'Restore default admin?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'admin',
                    role: 'admin',
                    branch_id: null
                })
            });
            if (res.ok) {
                toast.success(t('restore_success'));
            } else {
                const data = await res.json();
                toast.error(data.message || t('error_general'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                toast.success(t('save_success'));
                updateSettingsState(settings);
            } else {
                toast.error(t('error_general'));
            }
        } catch (err) {
            toast.error(t('network_error'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 font-bold">{t('loading_settings')}</p>
        </div>
    );

    const isDev = (currentUser?.role?.toLowerCase() === 'superadmin') ||
        (currentUser?.username?.toLowerCase() === 'dev_admin');

    const tabs = [
        { id: 'general', label: t('tab_general'), icon: Globe },
        { id: 'finance', label: t('tab_finance'), icon: DollarSign },
        { id: 'appearance', label: t('tab_appearance'), icon: Palette },
        { id: 'system', label: t('tab_system'), icon: Activity },
        ...(isDev ? [
            { id: 'developer', label: t('tab_developer'), icon: Shield }
        ] : []),
    ];

    return (
        <div className="max-w-5xl mx-auto pb-12" dir={dir}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Settings className="w-10 h-10 text-blue-600" />
                        {t('settings_title')}
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 font-medium mt-1">
                        {t('settings_desc')}
                    </p>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-8 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                    {saving ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                    {t('save_changes')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold transition-all ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20'
                                : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <tab.icon size={20} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 p-8 min-h-[500px] animate-in fade-in duration-500">

                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 border-b border-gray-50 dark:border-slate-800 pb-4">
                                    {t('tab_general')}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            {t('store_name')}
                                        </label>
                                        <input
                                            type="text"
                                            name="store_name"
                                            value={settings.store_name}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-950 border-none rounded-2xl p-4 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-sans"
                                            placeholder="My Store"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            {t('expiry_warning_days') || 'أيام تنبيه انتهاء البطاقة'}
                                        </label>
                                        <input
                                            type="number"
                                            name="expiry_warning_days"
                                            value={settings.expiry_warning_days}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-950 border-none rounded-2xl p-4 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            placeholder="7"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {t('expiry_warning_desc') || 'عدد الأيام قبل انتهاء البطاقة ليظهر تنبيه التحذير'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FINANCE TAB */}
                        {activeTab === 'finance' && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 border-b border-gray-50 dark:border-slate-800 pb-4 uppercase tracking-tight">
                                    {t('tab_finance')}
                                </h3>

                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            {t('currency_symbol')}
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 start-0 flex items-center ps-4 text-gray-400">
                                                <DollarSign size={18} />
                                            </span>
                                            <select
                                                name="currency_symbol"
                                                value={settings.currency_symbol}
                                                onChange={handleChange}
                                                className="w-full bg-gray-50 dark:bg-slate-950 border-none ps-11 rounded-2xl p-4 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="€">€ - Euro (يورو)</option>
                                                <option value="$">$ - US Dollar (دولار أمريكي)</option>
                                                <option value="ر.س">ر.س - Saudi Riyal (ريال سعودي)</option>
                                                <option value="د.إ">د.إ - UAE Dirham (درهم إماراتي)</option>
                                                <option value="£">£ - British Pound (جنيه إسترليني)</option>
                                                <option value="¥">¥ - Japanese Yen (ين ياباني)</option>
                                                <option value="د.ك">د.ك - Kuwaiti Dinar (دينار كويتي)</option>
                                                <option value="ر.ق">ر.ق - Qatari Riyal (ريال قطري)</option>
                                                <option value="ج.م">ج.م - Egyptian Pound (جنيه مصري)</option>
                                                <option value="₺">₺ - Turkish Lira (ليرة تركية)</option>
                                                <option value="₹">₹ - Indian Rupee (روبية هندية)</option>
                                                <option value="CHF">CHF - Swiss Franc (فرنك سويسري)</option>
                                                <option value="₽">₽ - Russian Ruble (روبل روسي)</option>
                                                <option value="R$">R$ - Brazilian Real (ريال برازيلي)</option>
                                                <option value="₩">₩ - South Korean Won (وون كوري)</option>
                                                <option value="S$">S$ - Singapore Dollar (دولار سنغافوري)</option>
                                                <option value="A$">A$ - Australian Dollar (دولار أسترالي)</option>
                                                <option value="C$">C$ - Canadian Dollar (دولار كندي)</option>
                                            </select>
                                            <span className="absolute inset-y-0 end-0 flex items-center pe-4 text-gray-400 pointer-events-none">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500 font-medium">
                                            {language === 'ar' ? 'اختر عملتك وسيتم تطبيق الرمز في كل مكان' : 'Select your currency and the symbol will be applied everywhere'}
                                        </p>
                                    </div>
                                </div>

                                {/* Dynamic Preview */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-6 border border-blue-100 dark:border-blue-900/40 relative overflow-hidden">
                                    <div className="flex items-start gap-4 relative z-10">
                                        <div className="p-3 bg-blue-500 text-white rounded-2xl">
                                            <Info size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-blue-900 dark:text-blue-200">
                                                {language === 'ar' ? 'معاينة حية للمبالغ' : 'Live Finance Preview'}
                                            </h4>
                                            <div className="mt-4 space-y-2">
                                                <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                                                    {language === 'ar' ? 'سعر مثال:' : 'Example Price:'} <span className="text-lg font-black">{settings.currency_symbol}100.00</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -right-10 -bottom-10 text-blue-200 dark:text-blue-900/20 rotate-12">
                                        <DollarSign size={140} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* APPEARANCE TAB */}
                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 border-b border-gray-50 dark:border-slate-800 pb-4">
                                    {t('tab_appearance')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            {t('upload_logo')}
                                        </label>
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                name="logo_url"
                                                value={settings.logo_url || ''}
                                                onChange={handleChange}
                                                className="flex-1 bg-gray-50 dark:bg-slate-950 border-none rounded-2xl p-4 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm"
                                                placeholder="https://example.com/logo.png"
                                            />
                                            <button
                                                type="button"
                                                disabled={uploading}
                                                onClick={() => document.getElementById('logo-upload').click()}
                                                className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300 font-bold min-w-[140px]"
                                            >
                                                {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                                {uploading ? t('uploading') : t('upload_logo')}
                                            </button>
                                            <input
                                                id="logo-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>

                                    {/* Logo Size Guide */}
                                    <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-6 border border-blue-100 dark:border-blue-900/40">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-blue-500 text-white rounded-xl">
                                                <Info size={18} />
                                            </div>
                                            <h4 className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">
                                                {t('logo_guide')}
                                            </h4>
                                        </div>
                                        <ul className="space-y-2 text-sm font-bold text-blue-800 dark:text-blue-300">
                                            <li className="flex items-center gap-2">• {t('logo_rec_square')}</li>
                                            <li className="flex items-center gap-2">• {t('logo_rec_wide')}</li>
                                            <li className="text-xs text-blue-600 dark:text-blue-400 font-black mt-3 flex items-center gap-2 italic">
                                                💡 {t('logo_max_size')}
                                            </li>
                                        </ul>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            {t('accent_color')}
                                        </label>
                                        <div className="flex gap-4 items-center">
                                            <input
                                                type="color"
                                                name="accent_color"
                                                value={settings.accent_color || '#3b82f6'}
                                                onChange={handleChange}
                                                className="h-14 w-24 rounded-2xl cursor-pointer border-none bg-transparent"
                                            />
                                            <span className="font-mono text-sm font-bold text-gray-500 uppercase">{settings.accent_color || '#3b82f6'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            {t('system_sounds')}
                                        </label>
                                        <div className="flex items-center gap-3 p-1 bg-gray-50 dark:bg-slate-950 rounded-2xl w-fit">
                                            <button
                                                onClick={() => setSettings({ ...settings, enable_sounds: 'true' })}
                                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${settings.enable_sounds === 'true' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
                                            >
                                                {t('on')}
                                            </button>
                                            <button
                                                onClick={() => setSettings({ ...settings, enable_sounds: 'false' })}
                                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${settings.enable_sounds === 'false' ? 'bg-white dark:bg-slate-800 shadow-sm text-red-600' : 'text-gray-400'}`}
                                            >
                                                {t('off')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SYSTEM TAB */}
                        {activeTab === 'system' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 border-b border-gray-50 dark:border-slate-800 pb-4">
                                    {t('system_info')}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/40">
                                        <div className="text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest mb-1">{t('db_connection')}</div>
                                        <div className="text-lg font-black text-emerald-900 dark:text-emerald-200">{t('status_healthy')}</div>
                                    </div>
                                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/40">
                                        <div className="text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest mb-1">{t('version')}</div>
                                        <div className="text-lg font-black text-blue-900 dark:text-blue-200">v{t('version_label')} 25</div>
                                    </div>
                                    <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-3xl border border-purple-100 dark:border-purple-900/40">
                                        <div className="text-purple-600 dark:text-purple-400 font-black text-xs uppercase tracking-widest mb-1">{t('api_status')}</div>
                                        <div className="text-lg font-black text-purple-900 dark:text-purple-200">{t('status_active')}</div>
                                    </div>
                                </div>

                                {/* DB Cleanup Settings */}
                                <div className="mt-8 bg-gray-50 dark:bg-slate-950 p-6 rounded-3xl border border-gray-100 dark:border-slate-800">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                <Database size={18} className="text-purple-500" />
                                                {t('enable_db_cleanup')}
                                            </h4>
                                            <p className="text-xs text-gray-500 font-medium mt-1">
                                                {t('db_cleanup_desc')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-3 p-1 bg-white dark:bg-slate-900 rounded-2xl w-fit shadow-sm">
                                                <button
                                                    onClick={() => setSettings({ ...settings, enable_db_cleanup: 'true' })}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${settings.enable_db_cleanup === 'true' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400'}`}
                                                >
                                                    {t('on')}
                                                </button>
                                                <button
                                                    onClick={() => setSettings({ ...settings, enable_db_cleanup: 'false' })}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${settings.enable_db_cleanup === 'false' ? 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-400' : 'text-gray-400'}`}
                                                >
                                                    {t('off')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {settings.enable_db_cleanup === 'true' && (
                                        <div className="mt-4 animate-in slide-in-from-top-2">
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                                {t('db_cleanup_days')}
                                            </label>
                                            <input
                                                type="number"
                                                name="db_cleanup_days"
                                                value={settings.db_cleanup_days}
                                                onChange={handleChange}
                                                className="w-full md:w-32 bg-white dark:bg-slate-900 border-none rounded-2xl p-3 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-center"
                                                placeholder="10"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 flex gap-4">
                                    <button
                                        className="flex-1 p-4 bg-gray-50 dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl font-black text-sm text-gray-600 dark:text-slate-400 transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700 font-sans"
                                        onClick={() => location.reload()}
                                    >
                                        {t('restart_system')}
                                    </button>
                                    <button
                                        className="flex-1 p-4 bg-gray-50 dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl font-black text-sm text-gray-600 dark:text-slate-400 transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700 font-sans"
                                        onClick={() => toast.info('Cache cleared!')}
                                    >
                                        {t('clear_cache')}
                                    </button>
                                </div>

                                {/* Developer Quick Access inside System Tab */}
                                {isDev && (
                                    <div className="mt-12 pt-12 border-t-2 border-dashed border-gray-100 dark:border-slate-800 animate-in slide-in-from-top-4 duration-500">
                                        <div className="bg-red-50/50 dark:bg-red-900/10 p-8 rounded-[2rem] border border-red-100 dark:border-red-900/20">
                                            <h4 className="text-xl font-black text-red-600 dark:text-red-400 mb-6 flex items-center gap-3">
                                                <Shield size={24} className="animate-pulse" />
                                                {t('tab_developer')}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Maintenance Mode */}
                                                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-red-50 dark:border-red-900/10 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                                <Activity size={18} className="text-orange-500" />
                                                                {t('maintenance_mode')}
                                                            </h5>
                                                            <p className="text-[10px] text-gray-500 font-medium mt-1">{t('maintenance_desc')}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-1 bg-gray-50 dark:bg-slate-950 rounded-xl">
                                                            <button
                                                                onClick={() => setSettings({ ...settings, maintenance_mode: 'true' })}
                                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${settings.maintenance_mode === 'true' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400'}`}
                                                            >
                                                                {t('on')}
                                                            </button>
                                                            <button
                                                                onClick={() => setSettings({ ...settings, maintenance_mode: 'false' })}
                                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${settings.maintenance_mode === 'false' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400'}`}
                                                            >
                                                                {t('off')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Admin Restore */}
                                                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-blue-50 dark:border-blue-900/10 space-y-4">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <h5 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                                <Shield size={18} className="text-blue-500" />
                                                                {t('emergency_admin_restore')}
                                                            </h5>
                                                            <p className="text-[10px] text-gray-500 font-medium mt-1">{t('emergency_admin_desc')}</p>
                                                        </div>
                                                        <button
                                                            onClick={handleEmergencyRestore}
                                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-xs flex items-center gap-2"
                                                        >
                                                            <Save size={14} />
                                                            {t('status_active')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="mt-6 text-[10px] font-bold text-red-400 italic text-center border-t border-red-50 dark:border-red-900/10 pt-4">
                                                {t('developer_notice')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DEVELOPER TOOLS TAB */}
                        {activeTab === 'developer' && isDev && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black text-red-600 dark:text-red-400 mb-6 border-b border-red-50 dark:border-red-900/10 pb-4 flex items-center gap-3">
                                    <Shield size={24} />
                                    {t('tab_developer')}
                                </h3>

                                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/40 relative overflow-hidden mb-6">
                                    <p className="text-sm font-bold text-red-800 dark:text-red-300 relative z-10 leading-relaxed">
                                        ⚠️ {t('developer_notice')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Maintenance Mode */}
                                    <div className="bg-gray-50 dark:bg-slate-950 p-6 rounded-3xl space-y-4">
                                        <div>
                                            <h4 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                <Activity size={18} className="text-orange-500" />
                                                {t('maintenance_mode')}
                                            </h4>
                                            <p className="text-xs text-gray-500 font-medium mt-1">
                                                {t('maintenance_desc')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 p-1 bg-white dark:bg-slate-900 rounded-2xl w-fit shadow-inner">
                                            <button
                                                onClick={() => setSettings({ ...settings, maintenance_mode: 'true' })}
                                                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${settings.maintenance_mode === 'true' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400'}`}
                                            >
                                                {t('on')}
                                            </button>
                                            <button
                                                onClick={() => setSettings({ ...settings, maintenance_mode: 'false' })}
                                                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${settings.maintenance_mode === 'false' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400'}`}
                                            >
                                                {t('off')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Admin Restore */}
                                    <div className="bg-gray-50 dark:bg-slate-950 p-6 rounded-3xl space-y-4">
                                        <div>
                                            <h4 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                <Shield size={18} className="text-blue-500" />
                                                {t('emergency_admin_restore')}
                                            </h4>
                                            <p className="text-xs text-gray-500 font-medium mt-1">
                                                {t('emergency_admin_desc')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleEmergencyRestore}
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Save size={18} />
                                            {t('emergency_admin_restore')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div >
    );
}
