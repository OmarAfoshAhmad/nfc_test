/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: 'var(--primary-color, #3b82f6)',
                blue: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: 'var(--primary-color, #3b82f6)',
                    600: 'var(--primary-color, #3b82f6)',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
                secondary: '#10b981',
                success: '#10b981',
                critical: '#ef4444',
                warning: '#f59e0b',
                dark: '#0f172a',
                't-primary': '#111827',
                't-secondary': '#4b5563',
                't-tertiary': '#9ca3af',
            }
        },
    },
    plugins: [],
};
