'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit, Users, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import DataTable from '@/components/DataTable';

export default function UserManagementPage() {
    const { t, dir } = useLanguage();
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [formData, setFormData] = useState({ id: null, username: '', password: '', role: 'staff', branch_id: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [uRes, bRes, meRes] = await Promise.all([
                fetch(`/api/users?deleted=${showDeleted}`),
                fetch('/api/branches'),
                fetch('/api/auth/me')
            ]);
            const uData = await uRes.json();
            const bData = await bRes.json();
            const meData = await meRes.json();
            setUsers(uData.data || []);
            setBranches(bData.data || []);
            setCurrentUser(meData.user || null);
        } catch (e) {
            toast.error(t('error_loading'));
        } finally {
            setLoading(false);
        }
    }, [showDeleted, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!formData.id;
        try {
            const res = await fetch(isEdit ? `/api/users/${formData.id}` : '/api/users', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('save_success'));
                setShowModal(false);
                setFormData({ id: null, username: '', password: '', role: 'staff', branch_id: '' });
                fetchData();
            }
            else {
                toast.error(data.message || 'Error');
            }
        } catch (err) {
            toast.error(t('network_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete'))) return;
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('delete_success'));
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.message);
            }
        } catch (e) {
            toast.error(t('delete_error'));
        }
    };

    const handleRestore = async (id) => {
        try {
            const res = await fetch(`/api/users`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });
            if (res.ok) {
                toast.success(t('restore_success') || 'Restored');
                fetchData();
            }
        } catch (e) {
            toast.error(t('restore_error'));
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    const columns = [
        {
            header: t('username'),
            accessor: 'username',
            className: 'font-bold text-gray-900 dark:text-white'
        },
        {
            header: t('role'),
            accessor: 'role',
            cell: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.role === 'superadmin' ? 'bg-black text-white' : row.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {t(row.role)}
                </span>
            )
        },
        {
            header: t('terminal_branch'),
            accessor: 'branch_id',
            cell: (row) => branches.find(b => b.id === row.branch_id)?.name || '---'
        },
        {
            header: t('status'),
            accessor: 'deleted_at',
            cell: (row) => row.deleted_at ? (
                <span className="text-[10px] font-bold uppercase text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{t('deleted') || 'Deleted'}</span>
            ) : (
                <span className="text-[10px] font-bold uppercase text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{t('active')}</span>
            )
        },
        {
            header: t('actions'),
            className: 'w-24',
            cell: (row) => (
                <div className={`flex gap-1`}>
                    {row.deleted_at ? (
                        <button
                            onClick={() => handleRestore(row.id)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title={t('restore')}
                        >
                            <RefreshCw size={16} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setFormData({
                                        id: row.id,
                                        username: row.username,
                                        password: '',
                                        role: row.role,
                                        branch_id: row.branch_id || ''
                                    });
                                    setShowModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(row.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="max-w-6xl mx-auto p-6" suppressHydrationWarning>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4`}>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        {t('nav_users')}
                        <Users size={28} className="text-blue-600" />
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('enterprise_desc')}</p>
                </div>
            </div>

            <div className="space-y-6">
                <DataTable
                    columns={columns}
                    data={filteredUsers}
                    loading={loading}
                    searchTerm={search}
                    onSearchChange={setSearch}
                    actions={
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setShowDeleted(!showDeleted)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-bold text-sm ${showDeleted
                                    ? 'bg-orange-50 border-orange-200 text-orange-600'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {showDeleted ? <EyeOff size={18} /> : <Eye size={18} />}
                                {showDeleted ? (t('hide_deleted') || 'Hide Deleted') : (t('show_deleted') || 'Show Deleted')}
                            </button>
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 font-bold flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                {t('add_user')}
                            </button>
                        </div>
                    }
                />

                {showModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                            <h2 className={`text-2xl font-bold mb-6 dark:text-white text-start`}>
                                {formData.id ? t('edit') : t('add_user')}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                        {t('username')}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start`}>
                                        {t('password')}
                                    </label>
                                    <input
                                        type="password"
                                        required={!formData.id}
                                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                    {formData.id && <p className={`text-[10px] text-gray-400 mt-1 text-start`}>{t('password_hint')}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start text-xs uppercase tracking-widest`}>
                                            {t('role')}
                                        </label>
                                        <select
                                            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        >
                                            <option value="admin">{t('admin')}</option>
                                            <option value="staff">{t('staff')}</option>
                                            {currentUser?.role === 'superadmin' && <option value="superadmin">{t('superadmin')}</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-start text-xs uppercase tracking-widest`}>
                                            {t('terminal_branch')}
                                        </label>
                                        <select
                                            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-start`}
                                            value={formData.branch_id}
                                            onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                        >
                                            <option value="">{t('all_branches')}</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg disabled:opacity-50">{t('save')}</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            setFormData({ id: null, username: '', password: '', role: 'staff', branch_id: '' });
                                        }}
                                        className="flex-1 bg-gray-100 dark:bg-gray-700 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300"
                                    >
                                        {t('cancel')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
