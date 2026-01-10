'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Branch } from '@/types/branch';
import { getAllBranches, BRANCHES } from '@/types/branch';

export default function CounterResetPage() {
    const [selectedBranch, setSelectedBranch] = useState<Branch>('surabaya');
    const [resetNumber, setResetNumber] = useState<string>('');
    const [allCounters, setAllCounters] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const loadAllCounters = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const counterRef = doc(db, 'metadata', 'stt_counters');
            const docSnap = await getDoc(counterRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setAllCounters(data);
                console.log('📊 Loaded counter data:', data);
            } else {
                setAllCounters({});
                setMessage({
                    type: 'error',
                    text: '❌ Counter document does not exist yet'
                });
            }
        } catch (error: any) {
            console.error('Error loading counters:', error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const resetCounter = async () => {
        const num = parseInt(resetNumber);
        if (isNaN(num) || num < 0) {
            setMessage({ type: 'error', text: 'Please enter a valid number' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const counterRef = doc(db, 'metadata', 'stt_counters');
            const branchInfo = BRANCHES[selectedBranch];

            console.log(`🔄 Resetting ${selectedBranch} counter to:`, num);

            await setDoc(counterRef, {
                [selectedBranch]: {
                    currentNumber: num,
                    prefix: 'STT',
                    branchName: branchInfo.displayName,
                    lastUpdated: new Date(),
                }
            }, { merge: true });

            const nextSTT = `STT${String(num + 1).padStart(6, '0')}`;
            setMessage({
                type: 'success',
                text: `✅ ${branchInfo.displayName} counter reset to ${num}. Next STT: ${nextSTT}`
            });

            // Reload all counters
            setTimeout(() => loadAllCounters(), 500);
        } catch (error: any) {
            console.error('❌ Error resetting counter:', error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    // Auto-load on mount
    useEffect(() => {
        loadAllCounters();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">
                        🔢 Multi-Branch STT Counter Management
                    </h1>

                    {/* All Counters Table */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Current Counters (All Branches)
                            </h2>
                            <button
                                onClick={loadAllCounters}
                                disabled={loading}
                                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:bg-gray-300"
                            >
                                🔄 Refresh
                            </button>
                        </div>

                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Branch</th>
                                        <th className="px-4 py-3 text-left font-semibold">Current Number</th>
                                        <th className="px-4 py-3 text-left font-semibold">Next STT</th>
                                        <th className="px-4 py-3 text-left font-semibold">Last Updated</th>
                                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getAllBranches().map(branch => {
                                        const counterData = allCounters[branch.id];
                                        const currentNum = counterData?.currentNumber ?? branch.initialCounter;
                                        const nextSTT = `STT${String(currentNum + 1).padStart(6, '0')}`;
                                        const isInitialized = !!counterData;

                                        return (
                                            <tr key={branch.id} className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">{branch.displayName}</td>
                                                <td className="px-4 py-3 font-mono">{currentNum}</td>
                                                <td className="px-4 py-3 font-mono text-blue-600 font-semibold">{nextSTT}</td>
                                                <td className="px-4 py-3 text-gray-600 text-xs">
                                                    {counterData?.lastUpdated
                                                        ? new Date(counterData.lastUpdated.seconds * 1000 || counterData.lastUpdated).toLocaleString('id-ID')
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isInitialized ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                                            Not Initialized
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Reset Counter Form */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">
                            Reset Counter
                        </h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Branch
                                    </label>
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => {
                                            setSelectedBranch(e.target.value as Branch);
                                            setResetNumber(''); // Clear reset number
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {getAllBranches().map(branch => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.displayName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reset Counter To:
                                    </label>
                                    <input
                                        type="number"
                                        value={resetNumber}
                                        onChange={(e) => setResetNumber(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder={`e.g. ${BRANCHES[selectedBranch].initialCounter + 1}`}
                                    />
                                </div>
                            </div>
                            {resetNumber && !isNaN(parseInt(resetNumber)) && (
                                <p className="text-sm text-gray-600 bg-white p-2 rounded border">
                                    Next STT will be: <strong className="text-blue-600">STT{String(parseInt(resetNumber) + 1).padStart(6, '0')}</strong>
                                </p>
                            )}
                            <button
                                onClick={resetCounter}
                                disabled={loading || !resetNumber}
                                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 font-medium"
                            >
                                {loading ? 'Resetting...' : `🔄 Reset ${BRANCHES[selectedBranch].displayName} Counter`}
                            </button>
                        </div>
                    </div>

                    {/* Message Display */}
                    {message && (
                        <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                            }`}>
                            <p className="font-medium">{message.text}</p>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h3 className="font-semibold text-gray-900 mb-2">⚠️ Important Notes:</h3>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            <li><strong>Multi-Branch System:</strong> Each branch has independent counter</li>
                            <li><strong>Surabaya:</strong> Pusat, continues from existing (~{BRANCHES.surabaya.initialCounter})</li>
                            <li><strong>Bandung:</strong> New branch, starts from {BRANCHES.bandung.initialCounter + 1} (STT00{BRANCHES.bandung.initialCounter + 1})</li>
                            <li>Setting counter to N means next transaction gets STT with N+1</li>
                            <li>Changes are immediate and affect new transactions</li>
                            <li>Each branch counter increments independently</li>
                        </ul>
                    </div>

                    {/* Back Button */}
                    <div className="mt-6">
                        <a
                            href="/"
                            className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                        >
                            ← Back to Main Menu
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
