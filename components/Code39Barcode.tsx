import React from 'react';

const CODE39_PATTERNS: { [key: string]: string } = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
    '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
};

interface Code39BarcodeProps {
    value: string;
    height?: number;
    narrowWidth?: number;
    wideWidth?: number;
}

export default function Code39Barcode({ 
    value, 
    height = 50, 
    narrowWidth = 1, 
    wideWidth = 2.5 
}: Code39BarcodeProps) {
    // Sanitize value to only Code 39 allowed characters
    const sanitized = value
        .toUpperCase()
        .replace(/[^A-Z0-9\-\.\s\$\/\+\%]/g, '');

    const uppercaseValue = `*${sanitized}*`;
    
    // Calculate total width first to set SVG viewBox
    let totalWidth = 0;
    for (let charIndex = 0; charIndex < uppercaseValue.length; charIndex++) {
        const char = uppercaseValue[charIndex];
        const pattern = CODE39_PATTERNS[char];
        if (!pattern) continue;
        
        for (let i = 0; i < 9; i++) {
            const isWide = pattern[i] === '1';
            totalWidth += isWide ? wideWidth : narrowWidth;
        }
        // Inter-character gap
        totalWidth += narrowWidth;
    }
    
    // Remove the trailing inter-character gap
    if (totalWidth > 0) {
        totalWidth -= narrowWidth;
    } else {
        totalWidth = 100; // fallback minimum
    }
    
    // Generate elements
    const elements: React.ReactNode[] = [];
    let currentX = 0;

    for (let charIndex = 0; charIndex < uppercaseValue.length; charIndex++) {
        const char = uppercaseValue[charIndex];
        const pattern = CODE39_PATTERNS[char];
        if (!pattern) continue;

        for (let i = 0; i < 9; i++) {
            const isBar = i % 2 === 0;
            const isWide = pattern[i] === '1';
            const width = isWide ? wideWidth : narrowWidth;

            if (isBar) {
                elements.push(
                    <rect
                        key={`${charIndex}-${i}`}
                        x={currentX}
                        y={0}
                        width={width}
                        height={height}
                        fill="black"
                    />
                );
            }
            currentX += width;
        }
        // Add inter-character gap (white space)
        currentX += narrowWidth;
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg
                viewBox={`0 0 ${totalWidth} ${height}`}
                width="100%"
                height="100%"
                style={{ display: 'block', maxHeight: '100%' }}
                xmlns="http://www.w3.org/2000/svg"
            >
                {elements}
            </svg>
        </div>
    );
}
