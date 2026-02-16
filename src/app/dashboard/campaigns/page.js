'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useSettings } from '@/lib/SettingsContext';
import {
    Plus, Megaphone, Settings, Trash2, Edit2,
    Gift, Zap, Calendar, DollarSign, Percent
} from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignsPage() {
    const { t, language } = useLanguage();
    const { settings } = useSettings();
    const currency = settings?.currency_symbol || '€';
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null); // Track if editing

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'BUNDLE', // Fixed: Default to BUNDLE for Package Manager
        trigger_min_spend: '',
        trigger_count: '', // For Bundle
        reward_type: 'PERCENTAGE',
        reward_value: '',
        validity_days: 30,
        price: '',
        usage_limit: 10,
        customer_type: '', // '' = All, 'single', 'family'
        bundle_type: '' // '', 'family', 'meat_family', 'youth', 'meat_individual', 'individual'
    });

    const [showDeleted, setShowDeleted] = useState(false);

    useEffect(() => {
        fetchCampaigns();
    }, [showDeleted]); // Refetch when mode changes

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/campaigns?deleted=${showDeleted}`);
            const data = await res.json();
            if (Array.isArray(data)) setCampaigns(data);
        } catch (error) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch('/api/campaigns', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true })
            });
            if (res.ok) {
                toast.success(t('save_success'));
                fetchCampaigns();
            }
        } catch (error) {
            toast.error(t('error_general'));
        }
    };

    const handleEdit = (camp) => {
        setEditingId(camp.id);
        setFormData({
            name: camp.name,
            description: camp.description || '',
            type: camp.type,
            trigger_min_spend: camp.trigger_condition?.min_spend || '',
            trigger_count: camp.trigger_condition?.target_count || '',
            reward_type: camp.reward_config?.type || 'PERCENTAGE',
            reward_value: camp.reward_config?.value || '',
            validity_days: camp.validity_days || 30,
            price: camp.price || 0,
            usage_limit: camp.usage_limit || 1,
            customer_type: camp.customer_type || '',
            bundle_type: camp.bundle_type || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prepare Payload
        const payload = {
            id: editingId, // Include ID if editing
            name: formData.name,
            description: formData.description,
            type: formData.type,
            trigger_condition: formData.type === 'AUTO_SPEND'
                ? { min_spend: parseFloat(formData.trigger_min_spend) || 0 }
                : formData.type === 'BUNDLE'
                    ? { target_count: parseInt(formData.trigger_count) || 5 }
                    : {},
            reward_config: {
                type: formData.reward_type,
                value: parseFloat(formData.reward_value),
            },
            // New Top-Level Fields
            validity_days: parseInt(formData.validity_days),
            price: parseFloat(formData.price) || 0,
            usage_limit: parseInt(formData.usage_limit) || 1,
            customer_type: formData.customer_type || null,
            bundle_type: formData.bundle_type || null,
            is_active: true
        };

        try {
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch('/api/campaigns', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(editingId ? t('save_success') : t('campaign_created_success'));
                setIsModalOpen(false);
                setEditingId(null);
                fetchCampaigns();
                setFormData({
                    name: '', description: '', type: 'BUNDLE',
                    trigger_min_spend: '', trigger_count: '',
                    reward_type: 'PERCENTAGE', reward_value: '', validity_days: 30,
                    price: '', usage_limit: 10, customer_type: '', bundle_type: ''
                });
            } else {
                const err = await res.json();
                toast.error(err.error || t('save_error'));
            }
        } catch (error) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الحملة؟' : 'Are you sure you want to delete this campaign?')) return;

        try {
            const res = await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchCampaigns();
            } else {
                const err = await res.json();
                toast.error(err.error || t('error_general'));
            }
        } catch (error) {
            toast.error(t('network_error'));
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!confirm(t('confirm_permanent_delete'))) return;

        try {
            const res = await fetch(`/api/campaigns?id=${id}&permanent=true`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchCampaigns();
            } else {
                const err = await res.json();
                toast.error(err.error || t('error_general'));
            }
        } catch (error) {
            toast.error(t('network_error'));
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2">
                        {showDeleted ? t('recycle_bin') : t('campaigns_title')}
                    </h1>
                    <p className="text-gray-500 font-medium">
                        {showDeleted ? t('recycle_desc') : t('campaigns_desc')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${showDeleted
                            ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            : 'bg-white text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        {showDeleted ? t('back_to_active') : t('recycle_btn')}
                    </button>
                    {!showDeleted && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setFormData({
                                    name: '', description: '', type: 'BUNDLE',
                                    trigger_min_spend: '', trigger_count: '',
                                    reward_type: 'PERCENTAGE', reward_value: '', validity_days: 30,
                                    price: '', usage_limit: 10, customer_type: '', bundle_type: ''
                                });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-blue-200 dark:shadow-none hover:scale-105 active:scale-95"
                        >
                            <Plus size={20} />
                            {t('new_campaign')}
                        </button>
                    )}
                </div>
            </div>

            {/* Campaign Grid */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">{t('loading')}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map(camp => (
                        <div key={camp.id} className="group bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all shadow-sm hover:shadow-xl relative overflow-hidden">
                            <div className={`absolute top-0 ${language === 'ar' ? 'left-0' : 'right-0'} p-6 opacity-5 group-hover:opacity-10 transition-opacity`}>
                                <Megaphone size={120} />
                            </div>

                            <div className="mb-4">
                                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 ${camp.type === 'AUTO_SPEND' ? 'bg-purple-100 text-purple-600' :
                                    camp.type === 'MANUAL' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {camp.type === 'AUTO_SPEND' ? t('type_auto_spend') :
                                        camp.type === 'BUNDLE' ? t('type_bundle') :
                                            camp.type === 'MANUAL' ? t('type_manual') : camp.type}
                                </span>
                                {camp.customer_type && (
                                    <span className={`inline-block ml-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3 ${camp.customer_type === 'family' ? 'bg-purple-100 text-purple-600' : 'bg-cyan-100 text-cyan-600'
                                        }`}>
                                        {camp.customer_type === 'family' ? t('type_family_short') : t('type_single_short')}
                                    </span>
                                )}
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 line-clamp-1">{camp.name}</h3>
                                <p className="text-sm text-gray-400 font-medium line-clamp-2">{camp.description || t('no_desc')}</p>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 space-y-3">
                                {/* Rule section */}
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700 text-gray-400">
                                        <Settings size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('trigger_rule_label')}</p>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            {camp.type === 'AUTO_SPEND'
                                                ? `${t('rule_spend_above')} ${camp.trigger_condition?.min_spend || 0}`
                                                : camp.type === 'BUNDLE'
                                                    ? t('rule_collect_stamps').replace('{count}', camp.trigger_condition?.target_count || 0)
                                                    : t('rule_manual_only')
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* Reward section */}
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center border border-green-100 dark:border-green-900/30 text-green-600">
                                        <Gift size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('reward_label')}</p>
                                        <p className="text-xs font-black text-gray-900 dark:text-white">
                                            {camp.reward_config?.value}
                                            {camp.reward_config?.type === 'PERCENTAGE' ? '%' : currency} {t('off_label')}
                                            <span className="text-gray-400 font-normal ml-1">({camp.reward_config?.validity_days} {t('days_label')})</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center gap-2">
                                {showDeleted ? (
                                    <>
                                        <button
                                            onClick={() => handleRestore(camp.id)}
                                            className="flex-1 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 font-bold hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                                        >
                                            {t('restore')}
                                        </button>
                                        <button
                                            onClick={() => handlePermanentDelete(camp.id)}
                                            className="p-2 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                                            title={t('delete_permanent')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleEdit(camp)}
                                            className="flex-1 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            {t('edit')}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(camp.id)}
                                            className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Add New Placeholder */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer min-h-[300px]"
                    >
                        <div className="h-16 w-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                            <Plus size={32} />
                        </div>
                        <span className="font-bold uppercase tracking-widest text-sm">{t('new_campaign')}</span>
                    </button>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg shadow-2xl p-8 animate-in zoom-in-95 duration-200" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                {editingId ? t('edit_campaign') : t('new_campaign')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">{t('cancel')}</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest mb-1.5 text-start">{t('campaign_name')}</label>
                                <input
                                    required
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-start"
                                    placeholder={t('campaign_name_placeholder')}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* TARGET AUDIENCE */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest mb-1.5 text-start">{t('target_audience')}</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['', 'single', 'family'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, customer_type: type })}
                                            className={`py-2 px-3 rounded-xl border-2 font-bold text-xs transition-all ${formData.customer_type === type
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'
                                                }`}
                                        >
                                            {type === '' ? t('all_customers') : type === 'family' ? t('type_family_short') : t('type_single_short')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest mb-1.5 text-start">{t('campaign_description')}</label>
                                <textarea
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-start min-h-[100px] resize-none"
                                    placeholder={t('campaign_description_placeholder')}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="text-start">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest mb-1.5">{t('validity_days')}</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none"
                                    value={formData.validity_days}
                                    onChange={e => setFormData({ ...formData, validity_days: e.target.value })}
                                />
                            </div>

                            {/* BUNDLE TYPE SELECTOR */}
                            <div className="text-start">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest mb-1.5">{t('bundle_type') || 'نوع الباقة'}</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'
                                                }`}
                                        >
                                            {language === 'ar' ? opt.label : opt.labelEn}
                                        </button>
                                    ))}
                                </div>
                            </div>


                            {/* REWARD VALUE (What does each unit give?) */}
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800 text-start">
                                <div className="flex items-center gap-2 mb-2 text-green-600 dark:text-green-400">
                                    <Gift size={16} />
                                    <span className="text-xs font-black uppercase tracking-widest">{t('reward_config')} ({t('per_unit') || 'Per Coupon'})</span>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 mb-1.5">{t('reward_type')}</label>
                                        <select
                                            className="w-full bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 font-bold text-gray-900 dark:text-white outline-none"
                                            value={formData.reward_type}
                                            onChange={e => setFormData({ ...formData, reward_type: e.target.value })}
                                        >
                                            <option value="PERCENTAGE">{t('reward_percent')}</option>
                                            <option value="FIXED">{t('reward_fixed')}</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-300 mb-1.5">{t('reward_value')}</label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 font-bold text-gray-900 dark:text-white outline-none"
                                            placeholder="100"
                                            value={formData.reward_value}
                                            onChange={e => setFormData({ ...formData, reward_value: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-100 uppercase tracking-widest"
                            >
                                {editingId ? t('save_changes') : t('launch_campaign')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
