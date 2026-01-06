'use client';

import { useState, ChangeEvent } from 'react';
import { formatRupiahInput, parseRupiah } from '@/lib/currency';

interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    helperText?: string;
    required?: boolean;
    className?: string;
}

export default function CurrencyInput({
    value,
    onChange,
    label,
    placeholder = '0',
    disabled = false,
    readOnly = false,
    helperText,
    required = false,
    className = '',
}: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState(formatRupiahInput(value));

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // Parse to number
        const numValue = parseRupiah(inputValue);

        // Update display with formatted value
        setDisplayValue(formatRupiahInput(numValue));

        // Call onChange with number value
        onChange(numValue);
    };

    const handleBlur = () => {
        // Re-format on blur
        setDisplayValue(formatRupiahInput(value));
    };

    const handleFocus = (e: ChangeEvent<HTMLInputElement>) => {
        // Select all on focus for easy editing
        e.target.select();
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-gray-700 font-semibold">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-medium">
                    Rp
                </span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readOnly}
                    className={`
            w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200
            focus:border-blue-500 focus:outline-none transition-all
            text-gray-800 font-medium
            ${disabled || readOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
                />
            </div>

            {helperText && (
                <p className="text-sm text-gray-500">{helperText}</p>
            )}
        </div>
    );
}
