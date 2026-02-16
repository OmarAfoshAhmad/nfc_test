'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Filter,
    Info,
    Gift,
    Zap,
    CheckCircle,
    RotateCcw,
    X,
    LayoutGrid,
    Users,
    ChevronRight,
    Loader2,
    Calendar,
    ArrowRightLeft,
    Tag,
    Clock,
    UserCheck,
    CreditCard
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';

export default function CampaignsPage() {
    const { t, language } = useLanguage();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        name_en: '',
        type: 'AUTO_SPEND',
        is_active: true,
        trigger_condition: {
            min_spend: 0,
            target_count: 5
        },
        reward_config: {
            type: 'PERCENTAGE',
            value: 10,
            validity_days: 30,
            splits: [] // For BUNDLE type
        },
        bundle_type: '', // family, youth, individual, etc.
        price: 0,
        customer_type: 'ALL', // ALL, NEW, REGULAR
        usage_limit: 1,
        description: '',
        validity_days: 30 // Primary validity
    });

    useEffect(() => {
        fetchCampaigns();
    }, [showDeleted]);

    async function fetchCampaigns() {
        setLoading(true);
        try {
            let query = supabase.from('campaigns').select('*');

            if (showDeleted) {
                query = query.not('deleted_at', 'is', null);
            } else {
                query = query.is('deleted_at', null);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setCampaigns(data || []);
        } catch (error) {
            toast.error(t('error_general'));
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            const campaignData = {
                ...formData,
                name_en: formData.name_en || formData.name,
                updated_at: new Date()
            };

            let error;
            if (editingCampaign) {
                const { error: err } = await supabase
                    .from('campaigns')
                    .update(campaignData)
                    .eq('id', editingCampaign.id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('campaigns')
                    .insert([campaignData]);
                error = err;
            }

            if (error) throw error;

            toast.success(editingCampaign ? t('update_success') : t('create_success'));
            setShowModal(false);
            resetForm();
            fetchCampaigns();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id, permanent = false) {
        if (!confirm(t('confirm_delete'))) return;

        try {
            let error;
            if (permanent) {
                const { error: err } = await supabase.from('campaigns').delete().eq('id', id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('campaigns')
                    .update({ deleted_at: new Date() })
                    .eq('id', id);
                error = err;
            }

            if (error) throw error;
            toast.success(t('delete_success'));
            fetchCampaigns();
        } catch (error) {
            toast.error(error.message);
        }
    }

    async function handleRestore(id) {
        try {
            const { error } = await supabase
                .from('campaigns')
                .update({ deleted_at: null })
                .eq('id', id);

            if (error) throw error;
            toast.success('Restored successfully');
            fetchCampaigns();
        } catch (error) {
            toast.error(error.message);
        }
    }

    function resetForm() {
        setFormData({
            name: '',
            name_en: '',
            type: 'AUTO_SPEND',
            is_active: true,
            trigger_condition: { min_spend: 0, target_count: 5 },
            reward_config: { type: 'PERCENTAGE', value: 10, validity_days: 30, splits: [] },
            bundle_type: '',
            price: 0,
            customer_type: 'ALL',
            usage_limit: 1,
            description: '',
            validity_days: 30
        });
        setEditingCampaign(null);
    }

    function handleEdit(campaign) {
        setEditingCampaign(campaign);
        setFormData({
            ...campaign,
            trigger_condition: campaign.trigger_condition || { min_spend: 0, target_count: 5 },
            reward_config: campaign.reward_config || { type: 'PERCENTAGE', value: 10, validity_days: 30, splits: [] }
        });
        setShowModal(true);
    }

    const filteredCampaigns = campaigns.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.name_en && c.name_en.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = filterType === 'ALL' || c.type === filterType;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50 dark:bg-transparent">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                        <Gift className="text-purple-600 dark:text-purple-400" size={32} />
                        {language === 'ar' ? 'إدارة الحملات والباقات' : 'Campaigns & Packages'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                        {language === 'ar' ? 'قم بإنشاء وتعديل العروض الترويجية وباقات الخصم' : 'Create and manage promotional offers and discount packages'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all border-2 ${showDeleted
                            ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900/50'
                            : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                            }`}
                    >
                        {showDeleted ? <LayoutGrid size={20} /> : <Trash2 size={20} />}
                        {language === 'ar' ? (showDeleted ? 'عرض النشطة' : 'المحذوفة') : (showDeleted ? 'Show Active' : 'Deleted')}
                    </button>

                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-purple-500/20"
                    >
                        <Plus size={22} className="stroke-[3px]" />
                        {language === 'ar' ? 'حملة جديدة' : 'New Campaign'}
                    </button>
                </div>
            </div>

            {/* Filter & Search */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
                <div className="lg:col-span-8 relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-purple-500 transition-colors">
                        <Search size={22} />
                    </div>
                    <input
                        type="text"
                        placeholder={language === 'ar' ? 'ابحث عن اسم الحملة...' : 'Search campaigns...'}
                        className="w-full bg-white dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700/50 rounded-2xl py-4 pl-12 pr-6 text-slate-900 dark:text-white font-bold outline-none ring-4 ring-transparent focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="lg:col-span-4 flex items-center gap-2">
                    {['ALL', 'AUTO_SPEND', 'BUNDLE', 'MANUAL'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`flex-1 py-4 px-2 rounded-2xl font-black text-xs transition-all border-2 ${filterType === type
                                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-purple-300'
                                }`}
                        >
                            {type === 'ALL' ? (language === 'ar' ? 'الكل' : 'All') :
                                type === 'AUTO_SPEND' ? (language === 'ar' ? 'تلقائي' : 'Auto') :
                                    type === 'BUNDLE' ? (language === 'ar' ? 'باقات' : 'Package') :
                                        (language === 'ar' ? 'يدوي' : 'Manual')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Campaigns Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                    <Loader2 className="animate-spin text-purple-600" size={48} />
                    <p className="text-slate-500 font-bold animate-pulse">{t('loading')}</p>
                </div>
            ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-white dark:bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700/50">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600">
                        <Gift size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                        {language === 'ar' ? 'لا توجد حملات متاحة' : 'No campaigns found'}
                    </h3>
                    <p className="text-slate-500 max-w-sm">
                        {language === 'ar' ? 'ابدأ بإضافة حملة جديدة لزيادة مبيعاتك ومكافأة عملائك' : 'Start by adding a new campaign to boost sales and reward customers'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredCampaigns.map((campaign) => (
                        <div
                            key={campaign.id}
                            className={`group relative bg-white dark:bg-slate-800/40 rounded-[2.5rem] border-2 transition-all hover:scale-[1.02] hover:shadow-2xl overflow-hidden ${campaign.is_active ? 'border-slate-100 dark:border-slate-700/30' : 'border-slate-200 dark:border-slate-700 opacity-75'
                                } shadow-xl shadow-slate-200/50 dark:shadow-none`}
                        >
                            {/* Card Content... (Header) */}
                            <div className="p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div className={`p-4 rounded-3xl ${campaign.type === 'BUNDLE' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' :
                                        campaign.type === 'AUTO_SPEND' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' :
                                            'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                        }`}>
                                        {campaign.type === 'BUNDLE' ? <ArrowRightLeft size={28} /> :
                                            campaign.type === 'AUTO_SPEND' ? <Zap size={28} /> :
                                                <Gift size={28} />}
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-2xl">
                                        <div className={`w-2.5 h-2.5 rounded-full ${campaign.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            {campaign.is_active ? (language === 'ar' ? 'نشط' : 'ACTIVE') : (language === 'ar' ? 'غير نشط' : 'INACTIVE')}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 group-hover:text-purple-600 transition-colors">
                                    {language === 'ar' ? campaign.name : (campaign.name_en || campaign.name)}
                                </h3>

                                <div className="flex items-center gap-2 mb-6">
                                    <span className="text-[10px] font-black bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-lg uppercase tracking-wider">
                                        {campaign.type}
                                    </span>
                                    {campaign.customer_type !== 'ALL' && (
                                        <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg uppercase tracking-wider">
                                            {campaign.customer_type} {language === 'ar' ? 'عملاء' : 'CUSTOMERS'}
                                        </span>
                                    )}
                                </div>

                                {/* Main Stats */}
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-slate-50 dark:bg-slate-700/20 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                            {language === 'ar' ? 'المكافأة' : 'Reward'}
                                        </span>
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                                            {campaign.reward_config?.type === 'PERCENTAGE'
                                                ? `${campaign.reward_config?.value}%`
                                                : `${campaign.reward_config?.value}₪`}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-700/20 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                            {language === 'ar' ? 'الصلاحية' : 'Validity'}
                                        </span>
                                        <span className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                                            {campaign.validity_days || 30}
                                            <span className="text-xs text-slate-400">{language === 'ar' ? 'يوم' : 'Days'}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Trigger Details */}
                                <div className="space-y-3 mb-8">
                                    {campaign.type === 'AUTO_SPEND' && (
                                        <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                            <Tag size={16} className="text-amber-500" />
                                            <span>
                                                {language === 'ar' ? 'الحد الأدنى للإنفاق:' : 'Min Spend:'} {campaign.trigger_condition?.min_spend || 0}₪
                                            </span>
                                        </div>
                                    )}
                                    {campaign.type === 'BUNDLE' && (
                                        <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                            <CreditCard size={16} className="text-indigo-500" />
                                            <span>
                                                {language === 'ar' ? 'السعر البيعي:' : 'Sale Price:'} {campaign.price || 0}₪
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                        <Clock size={16} className="text-slate-400" />
                                        <span>
                                            {language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}: {new Date(campaign.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    {showDeleted ? (
                                        <>
                                            <button
                                                onClick={() => handleRestore(campaign.id)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl font-black transition-all shadow-lg shadow-emerald-500/20"
                                            >
                                                <RotateCcw size={18} />
                                                {language === 'ar' ? 'استعادة' : 'Restore'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(campaign.id, true)}
                                                className="px-6 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-red-500/20"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEdit(campaign)}
                                                className="flex-1 flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-700 text-white py-4 rounded-2xl font-black transition-all hover:bg-purple-600 shadow-lg active:scale-95"
                                            >
                                                <Edit2 size={18} className="stroke-[3px]" />
                                                {language === 'ar' ? 'تعديل' : 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(campaign.id)}
                                                className="w-16 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500/50 rounded-2xl transition-all shadow-lg active:scale-95"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Campaign Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl animate-in fade-in" onClick={() => setShowModal(false)} />

                    <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                                    {editingCampaign
                                        ? (language === 'ar' ? 'تعديل الحملة' : 'Edit Campaign')
                                        : (language === 'ar' ? 'إنشاء حملة جديدة' : 'Create New Campaign')}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    {editingCampaign ? editingCampaign.id : 'New Entry'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-14 h-14 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-white hover:bg-red-500 rounded-3xl transition-all"
                            >
                                <X size={28} />
                            </button>
                        </div>

                        {/* Modal Content - Tabs/Scrollable Area */}
                        <form onSubmit={handleSubmit} className="overflow-y-auto p-8 max-h-[calc(90vh-120px)] custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column: Basic Info */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'اسم الحملة' : 'Campaign Name'}</label>
                                        <input
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-purple-600 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 font-bold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                                            placeholder="..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                                        <input
                                            value={formData.name_en}
                                            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-purple-600 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 font-bold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                                            placeholder="..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'نوع الحملة' : 'Campaign Type'}</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['AUTO_SPEND', 'BUNDLE', 'MANUAL'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: type })}
                                                    className={`py-3 rounded-xl font-black text-[10px] tracking-tighter uppercase transition-all ${formData.type === type
                                                        ? 'bg-purple-600 text-white shadow-lg'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                                >
                                                    {type === 'AUTO_SPEND' ? (language === 'ar' ? 'تلقائي' : 'Auto') :
                                                        type === 'BUNDLE' ? (language === 'ar' ? 'باقات' : 'Package') :
                                                            (language === 'ar' ? 'يدوي' : 'Manual')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Additional specific fields per type */}
                                    {formData.type === 'AUTO_SPEND' && (
                                        <div className="space-y-2 animate-in slide-in-from-left-2">
                                            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'الحد الأدنى للإنفاق' : 'Min Spend (₪)'}</label>
                                            <input
                                                type="number"
                                                value={formData.trigger_condition.min_spend}
                                                onChange={(e) => setFormData({ ...formData, trigger_condition: { ...formData.trigger_condition, min_spend: parseFloat(e.target.value) } })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-amber-500 rounded-2xl px-5 py-4 font-bold text-slate-900 dark:text-white outline-none"
                                            />
                                        </div>
                                    )}

                                    {formData.type === 'BUNDLE' && (
                                        <div className="space-y-2 animate-in slide-in-from-left-2">
                                            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'سعر البيع المسبق' : 'Purchase Price (₪)'}</label>
                                            <input
                                                type="number"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 font-bold text-slate-900 dark:text-white outline-none"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-purple-600 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 font-bold text-slate-900 dark:text-white outline-none transition-all shadow-inner h-24 resize-none"
                                            placeholder="..."
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Configuration */}
                                <div className="space-y-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] p-6 border-2 border-slate-100 dark:border-slate-800 space-y-6">
                                        <h4 className="text-sm font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <Gift size={18} />
                                            {language === 'ar' ? 'إعدادات المكافأة' : 'Reward settings'}
                                        </h4>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase">{language === 'ar' ? 'نوع الخصم' : 'Type'}</label>
                                                <select
                                                    value={formData.reward_config.type}
                                                    onChange={(e) => setFormData({ ...formData, reward_config: { ...formData.reward_config, type: e.target.value } })}
                                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none text-slate-900 dark:text-white"
                                                >
                                                    <option value="PERCENTAGE">{language === 'ar' ? 'نسبة مئوية' : 'Percentage'}</option>
                                                    <option value="FIXED">{language === 'ar' ? 'مبلغ ثابت' : 'Fixed'}</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase">{language === 'ar' ? 'القيمة' : 'Value'}</label>
                                                <input
                                                    type="number"
                                                    value={formData.reward_config.value}
                                                    onChange={(e) => setFormData({ ...formData, reward_config: { ...formData.reward_config, value: parseFloat(e.target.value) } })}
                                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none text-slate-900 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase">{language === 'ar' ? 'صلاحية المكافأة (يوم)' : 'Reward Validity (Days)'}</label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="365"
                                                    value={formData.validity_days}
                                                    onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                                                    className="flex-1 accent-purple-600"
                                                />
                                                <span className="w-16 text-center font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 rounded-lg py-1">
                                                    {formData.validity_days}
                                                </span>
                                            </div>
                                        </div>

                                        {formData.type === 'BUNDLE' && (
                                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                                                <label className="text-xs font-black text-slate-400 uppercase">{language === 'ar' ? 'تخطيط تقسيم الباقة' : 'Bundle Split Layout'}</label>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { value: '', label: 'افتراضي', labelEn: 'Default' },
                                                        { value: 'family', label: 'عائلة (3%+5%+7%+10%+25%)', labelEn: 'Family' },
                                                        { value: 'meat_family', label: 'لحمة عائلة (2%+2%+3%+3%+10%)', labelEn: 'Meat Family' },
                                                        { value: 'youth', label: 'شباب (2%+4%+3%+3%+12%)', labelEn: 'Youth' },
                                                        { value: 'meat_individual', label: 'لحمة أفراد (2.5%+2.5%+5%)', labelEn: 'Meat Indiv.' },
                                                        { value: 'individual', label: 'أفراد (2%+2%+3%+3%+10%)', labelEn: 'Individual' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, bundle_type: opt.value })}
                                                            className={`py-2 px-2 rounded-xl border-2 font-bold text-[10px] transition-all ${formData.bundle_type === opt.value
                                                                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-600 dark:text-purple-400'
                                                                : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-500 hover:border-purple-300'}`}
                                                        >
                                                            {language === 'ar' ? opt.label : opt.labelEn}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 flex gap-3 text-start">
                                                    <Info size={18} className="text-amber-600 shrink-0" />
                                                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-tight">
                                                        {language === 'ar'
                                                            ? 'يتم تقسيم الباقة إلى كوبونات صغيرة وقسيمة بونص واحدة بناءً على النسبة المختارة أعلاه'
                                                            : 'Bundle will be split into small coupons + one bonus part based on selected pattern'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'فئة العملاء' : 'Target Customers'}</label>
                                            <select
                                                value={formData.customer_type}
                                                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-purple-600 rounded-2xl px-5 py-4 font-bold outline-none"
                                            >
                                                <option value="ALL">{t('all_customers') || 'All'}</option>
                                                <option value="NEW">{language === 'ar' ? 'جديد' : 'New'}</option>
                                                <option value="REGULAR">{language === 'ar' ? 'دائم' : 'Regular'}</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2 text-start">
                                            <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'الحالة' : 'Status'}</label>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                                className={`w-full py-4 rounded-2xl font-black text-lg transition-all border-2 flex items-center justify-center gap-3 ${formData.is_active
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-950 dark:border-emerald-500'
                                                    : 'bg-slate-50 border-slate-300 text-slate-400'
                                                    }`}
                                            >
                                                {formData.is_active ? <CheckCircle size={22} /> : <X size={22} />}
                                                {formData.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'متوقف' : 'Disabled')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="mt-12 flex gap-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-5 rounded-[2rem] font-black text-xl shadow-2xl shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : (editingCampaign ? (language === 'ar' ? 'تحديث البيانات' : 'Update Campaign') : (language === 'ar' ? 'إنشاء الحملة' : 'Create Campaign'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
