'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({
        store_name: 'NFC Discount',
        logo_url: null,
        currency_symbol: '€'
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings?t=' + Date.now());
            const data = await res.json();
            if (data.success && data.data) {
                setSettings(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const refreshSettings = () => fetchSettings();

    const updateSettingsState = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    // Apply Accent Color Dynamically
    useEffect(() => {
        if (typeof window !== 'undefined' && settings.accent_color) {
            const root = document.documentElement;
            root.style.setProperty('--primary-color', settings.accent_color);
            // Also generate a slightly transparent version for shadows/bg
            root.style.setProperty('--primary-color-alpha', `${settings.accent_color}33`); // 20% opacity
        }
    }, [settings.accent_color]);

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings, updateSettingsState }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
