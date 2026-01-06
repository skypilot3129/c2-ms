'use client';

import { use, useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getInvoiceById } from '@/lib/firestore-invoices';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';

function PrintInvoiceContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const inv = await getInvoiceById(id);
            if (inv) {
                setInvoice(inv);
                const txItems = await Promise.all(inv.transactionIds.map(tid => getTransactionById(tid)));
                setTransactions(txItems.filter((t): t is Transaction => t !== null));
            }
            setLoading(false);
        };
        loadData();
    }, [id, user]);

    useEffect(() => {
        if (!loading && invoice) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, invoice]);

    if (!invoice) return <div className="p-8 text-center">Memuat invoice...</div>;

    return (
        <div className="bg-white min-h-screen p-12 text-gray-800 font-sans max-w-[210mm] mx-auto">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-12 border-b-2 border-gray-800 pb-8">
                <div>
                    <h1 className="text-4xl font-bold uppercase tracking-wider mb-2 text-blue-900">Invoice</h1>
                    <p className="font-semibold text-lg">{invoice.invoiceNumber}</p>
                </div>
                <div className="text-right">
                    <h2 className="font-bold text-xl text-gray-800">Cahaya Cargo Express</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Jalan Contoh No. 123<br />
                        Jakarta, Indonesia<br />
                        Telp: (021) 1234-5678
                    </p>
                </div>
            </div>

            {/* Bill To & Details */}
            <div className="flex justify-between mb-12">
                <div>
                    <p className="text-gray-500 uppercase text-xs tracking-wider mb-2">Tagihan Kepada</p>
                    <h3 className="font-bold text-lg">{invoice.clientName}</h3>
                    <p className="text-gray-600 max-w-xs">{invoice.clientAddress || 'Alamat tidak tersedia'}</p>
                </div>
                <div className="text-right">
                    <div className="mb-4">
                        <p className="text-gray-500 uppercase text-xs tracking-wider mb-1">Tanggal Invoice</p>
                        <p className="font-semibold">{invoice.issueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 uppercase text-xs tracking-wider mb-1">Jatuh Tempo</p>
                        <p className="font-semibold text-red-600">{invoice.dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-left mb-8">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tanggal</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No STT</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Rute / Tujuan</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Jumlah</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {transactions.map((t, index) => (
                        <tr key={t.id}>
                            <td className="py-4 text-gray-500">{index + 1}</td>
                            <td className="py-4 text-gray-600">{new Date(t.tanggal).toLocaleDateString('id-ID')}</td>
                            <td className="py-4 font-mono font-medium">{t.noSTT}</td>
                            <td className="py-4">{t.tujuan}</td>
                            <td className="py-4 text-right font-medium">{formatRupiah(t.jumlah)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-1/2">
                    <div className="flex justify-between py-3 border-b border-gray-200">
                        <span className="text-gray-600">Total Item</span>
                        <span className="font-medium">{transactions.length} Resi</span>
                    </div>
                    <div className="flex justify-between py-4 border-b-2 border-gray-800">
                        <span className="font-bold text-xl">Total Tagihan</span>
                        <span className="font-bold text-xl text-blue-600">{formatRupiah(invoice.totalAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Footer / Payment Info */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2">Informasi Pembayaran</h4>
                <p className="text-gray-600 text-sm mb-4">
                    Mohon lakukan pembayaran sebelum tanggal jatuh tempo. Sertakan nomor invoice pada berita acara transfer.
                </p>
                <div className="flex gap-8 text-sm">
                    <div>
                        <p className="text-gray-500 text-xs uppercase">Bank BCA</p>
                        <p className="font-mono font-medium">123-456-7890</p>
                        <p className="text-gray-600">a.n Cahaya Cargo</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs uppercase">Bank Mandiri</p>
                        <p className="font-mono font-medium">987-654-3210</p>
                        <p className="text-gray-600">a.n Cahaya Cargo</p>
                    </div>
                </div>
                {invoice.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-gray-500 text-xs uppercase mb-1">Catatan Tambahan</p>
                        <p className="text-gray-700 italic">"{invoice.notes}"</p>
                    </div>
                )}
            </div>

            <div className="mt-12 text-center text-xs text-gray-400">
                <p>Terima kasih atas kepercayaannya menggunakan jasa Cahaya Cargo Express.</p>
            </div>
        </div>
    );
}

export default function PrintInvoicePage(props: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintInvoiceContent params={props.params} />
        </Suspense>
    );
}
