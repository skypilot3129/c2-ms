'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRange = {
    startDate: Date;
    endDate: Date;
    label: string;
};

interface DateRangePickerProps {
    onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ onChange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState('Bulan Ini');

    // Preset ranges
    const presets = [
        {
            label: 'Hari Ini',
            getRange: () => {
                const now = new Date();
                return {
                    startDate: new Date(now.setHours(0, 0, 0, 0)),
                    endDate: new Date(now.setHours(23, 59, 59, 999))
                };
            }
        },
        {
            label: 'Kemarin',
            getRange: () => {
                const now = new Date();
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                return {
                    startDate: new Date(yesterday.setHours(0, 0, 0, 0)),
                    endDate: new Date(yesterday.setHours(23, 59, 59, 999))
                };
            }
        },
        {
            label: 'Bulan Ini',
            getRange: () => {
                const now = new Date();
                return {
                    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
                    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
                };
            }
        },
        {
            label: 'Bulan Lalu',
            getRange: () => {
                const now = new Date();
                return {
                    startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
                };
            }
        },
        {
            label: 'Tahun Ini',
            getRange: () => {
                const now = new Date();
                return {
                    startDate: new Date(now.getFullYear(), 0, 1),
                    endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59)
                };
            }
        }
    ];

    const handleSelect = (preset: typeof presets[0]) => {
        const range = preset.getRange();
        setSelectedLabel(preset.label);
        onChange({ ...range, label: preset.label });
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
            >
                <Calendar size={18} className="text-gray-500" />
                <span className="font-medium text-gray-700">{selectedLabel}</span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="py-1">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handleSelect(preset)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${selectedLabel === preset.label ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-600'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Overlay to close on click outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                ></div>
            )}
        </div>
    );
}
