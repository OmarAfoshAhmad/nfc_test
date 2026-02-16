'use client';
import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = "Select...",
    label = "Select",
    displayValue = (opt) => opt.label,
    className = ""
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);
    const { dir } = useLanguage();

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        if (selectedOption && !isOpen) {
            setSearch(displayValue(selectedOption));
        } else if (value && !selectedOption && !isOpen) {
            setSearch(value);
        } else if (!value && !isOpen) {
            setSearch('');
        }
    }, [value, isOpen, selectedOption, displayValue]);

    const filteredOptions = options.filter(opt =>
        displayValue(opt).toLowerCase().includes(search.toLowerCase()) ||
        String(opt.value).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'} ${dir === 'rtl' ? 'pl-10' : 'pr-10'}`}
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                        if (e.target.value === '') {
                            onChange('');
                        }
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                    }}
                />
                <div className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${dir === 'rtl' ? 'left-3' : 'right-3'}`}>
                    {value ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearch('');
                                setIsOpen(true);
                            }}
                            className="hover:text-red-500"
                        >
                            <X size={16} />
                        </button>
                    ) : (
                        <ChevronsUpDown size={16} />
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100">
                    {filteredOptions.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">No options found</div>
                    ) : (
                        filteredOptions.map((opt) => (
                            <div
                                key={opt.value}
                                className={`px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-200'}`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setSearch(displayValue(opt));
                                    setIsOpen(false);
                                }}
                            >
                                <span>{displayValue(opt)}</span>
                                {value === opt.value && <Check size={16} />}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
