'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getTransactionById } from '@/lib/firestore-transactions';
import type { Transaction, SuratJalanData } from '@/types/transaction';
import { COMPANY_INFO } from '@/lib/company-config';

export default function PrintSuratJalanPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);

    // Parse all surat jalan data from URL params (updated for new structure)
    const suratJalan: SuratJalanData = {
        tanggalPC: searchParams.get('tanggalPC') || new Date().toISOString().split('T')[0],
        nomorMobil: searchParams.get('mobil') || '',
        namaSopir: searchParams.get('sopir') || '',
        rute: searchParams.get('rute') || '',
        namaPengirim: searchParams.get('namaPengirim') || '',
        alamatPengirim: searchParams.get('alamatPengirim') || '',
        namaPenerima: searchParams.get('namaPenerima') || '',
        alamatPenerima: searchParams.get('alamatPenerima') || '',
        konsesiBaik: searchParams.get('konsesiBaik') === 'true',
        konsesiRusak: searchParams.get('konsesiRusak') === 'true',
        konsesiBerkurang: searchParams.get('konsesiBerkurang') === 'true',
        konsesiKeterangan: searchParams.get('konsesiKeterangan') || '',
        asuransi: searchParams.get('asuransi') === 'true',
        pembayaranOngkos: searchParams.get('pembayaranOngkos') || '',
        caraPembayaran: (searchParams.get('caraPembayaran') as 'tunai' | 'invoice' | 'bank') || 'tunai',
        dimensi: searchParams.get('dimensi') || '',
        beratVolume: parseFloat(searchParams.get('beratVolume') || '0') || undefined,
        satuanVolume: (searchParams.get('satuanVolume') as 'M3' | 'KG') || undefined,
        catatanKhusus: searchParams.get('catatanKhusus') || '',
    };

    useEffect(() => {
        const loadTransaction = async () => {
            if (!params.id || typeof params.id !== 'string') return;

            try {
                const data = await getTransactionById(params.id);
                setTransaction(data);
                setLoading(false);

                // Auto print when loaded
                if (data) {
                    setTimeout(() => window.print(), 500);
                }
            } catch (error) {
                console.error('Error loading transaction:', error);
                setLoading(false);
            }
        };

        loadTransaction();
    }, [params.id]);

    if (loading || !transaction) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Memuat surat jalan...</p>
                </div>
            </div>
        );
    }

    const tanggalPCFormatted = suratJalan.tanggalPC
        ? new Date(suratJalan.tanggalPC).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : new Date(transaction.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

    return (
        <>
            {/* Compact Print Styles - 148mm max height */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 5mm 8mm;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }
                    .no-print { display: none !important; }
                }
                
                * { box-sizing: border-box; }
                
                .surat-form {
                    width: 210mm;
                    max-height: 148mm;
                    padding: 2mm 3mm;
                    font-family: Arial, sans-serif;
                    background: white;
                    position: relative;
                    overflow: hidden;
                }
                
                .form-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1.5px solid #000;
                }
                
                .form-table td {
                    border: 1px solid #000;
                    padding: 1mm;
                    vertical-align: top;
                    font-size: 7px;
                    line-height: 1.2;
                }
                
                .section-header {
                    font-weight: bold;
                    font-size: 7px;
                    text-transform: uppercase;
                    border-bottom: 1px solid #000;
                    padding-bottom: 0.5mm;
                    margin-bottom: 0.5mm;
                }
                
                .label {
                    font-size: 6px;
                    font-weight: bold;
                    color: #333;
                }
                
                .value {
                    font-size: 7px;
                    margin-top: 0.3mm;
                }
                
                .checkbox-group label {
                    display: inline-block;
                    margin-right: 2mm;
                    font-size: 7px;
                }
                
                .signature-area {
                    height: 12mm;
                    position: relative;
                }
                
                .signature-line {
                    position: absolute;
                    bottom: 2mm;
                    left: 0;
                    right: 0;
                    border-top: 1px solid #000;
                    text-align: center;
                    padding-top: 0.3mm;
                    font-size: 6px;
                }
            `}} />

            <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700">
                    🖨️ Print
                </button>
                <button onClick={() => router.back()} className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-gray-700">
                    ✕ Tutup
                </button>
            </div>

            <div className="surat-form">
                {/* HEADER - 3 Office Addresses */}
                <div style={{ borderBottom: '2px solid #1e3a8a', marginBottom: '1mm', paddingBottom: '1mm' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Logo & Company Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                            <img src="/logo.png" alt="Logo CCE" style={{ width: '14mm', height: '14mm', objectFit: 'contain' }} />
                            <div>
                                <h1 style={{ fontSize: '12px', fontWeight: 'bold', margin: 0, color: '#1e3a8a' }}>
                                    {COMPANY_INFO.name}
                                </h1>
                                <div style={{ fontSize: '6px', marginTop: '0.5mm', lineHeight: 1.3 }}>
                                    <p style={{ margin: '0.3mm 0' }}>
                                        <strong>Jl. Kalimas Baru</strong> (Pasilahan Kalimas) No. 60 - Surabaya HP : <strong>081 337 878 138</strong>
                                    </p>
                                    <p style={{ margin: '0.3mm 0' }}>
                                        <strong>Jl. Gelandakan</strong> (Ps Sentra Bilanja Hancap) G1 - Banjarmasin HP : <strong>081 2954 777</strong>
                                    </p>
                                    <p style={{ margin: '0.3mm 0' }}>
                                        <strong>Jl. Irian No. 245 B</strong> - Makassar HP : <strong>0852 4228 0396</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Resi & Date */}
                        <div style={{ textAlign: 'right', fontSize: '7px' }}>
                            <p style={{ margin: 0, marginBottom: '0.5mm' }}>
                                <strong>NO. RESI:</strong> <span style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '8px' }}>{transaction.noSTT}</span>
                            </p>
                            <p style={{ margin: 0 }}>
                                <strong>Tanggal:</strong> {tanggalPCFormatted}
                            </p>
                        </div>
                    </div>
                </div>

                {/* TITLE */}
                <h2 style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    letterSpacing: '2px',
                    margin: '0.5mm 0 1mm 0',
                    color: '#1e3a8a'
                }}>
                    SURAT TANDA TERIMA
                </h2>

                {/* MAIN FORM TABLE */}
                <table className="form-table">
                    <tbody>
                        {/* ROW 1: Pengirim | Penerima | Lain-Lain */}
                        <tr>
                            <td style={{ width: '33%' }}>
                                <div className="section-header">1. PENGIRIM</div>
                                <div>
                                    <div className="label">PERUSAHAAN</div>
                                    <div className="value">{transaction.pengirimName || '-'}</div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">NAMA</div>
                                    <div className="value">{suratJalan.namaPengirim || transaction.pengirimName || '-'}</div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">ALAMAT</div>
                                    <div className="value" style={{ fontSize: '6.5px' }}>
                                        {suratJalan.alamatPengirim || transaction.pengirimAddress || '-'}
                                    </div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">TELP</div>
                                    <div className="value">{transaction.pengirimPhone || '-'}</div>
                                </div>
                            </td>

                            <td style={{ width: '33%' }}>
                                <div className="section-header">2. PENERIMA</div>
                                <div>
                                    <div className="label">PERUSAHAAN</div>
                                    <div className="value">{transaction.penerimaName || '-'}</div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">NAMA</div>
                                    <div className="value">{suratJalan.namaPenerima || transaction.penerimaName || '-'}</div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">ALAMAT</div>
                                    <div className="value" style={{ fontSize: '6.5px' }}>
                                        {suratJalan.alamatPenerima || transaction.penerimaAddress || '-'}
                                    </div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">TELP</div>
                                    <div className="value">{transaction.penerimaPhone || '-'}</div>
                                </div>
                            </td>

                            <td style={{ width: '34%' }}>
                                <div className="section-header">3. LAIN - LAIN</div>
                                <div className="label" style={{ fontSize: '6px', marginBottom: '0.5mm' }}>
                                    KONDISI DITERIMA DENGAN
                                </div>
                                <div className="checkbox-group">
                                    <label>
                                        <input type="checkbox" checked={suratJalan.konsesiBaik} readOnly /> Baik
                                    </label>
                                    <label>
                                        <input type="checkbox" checked={suratJalan.konsesiRusak} readOnly /> Rusak
                                    </label>
                                    <label>
                                        <input type="checkbox" checked={suratJalan.konsesiBerkurang} readOnly /> Berkurang
                                    </label>
                                </div>
                                {suratJalan.konsesiKeterangan && (
                                    <div style={{ marginTop: '0.5mm', fontSize: '6px' }}>
                                        <div className="label">KETERANGAN:</div>
                                        <div>{suratJalan.konsesiKeterangan}</div>
                                    </div>
                                )}
                                <div style={{ marginTop: '1mm' }}>
                                    <div className="label">ASURANSI</div>
                                    <div className="checkbox-group" style={{ marginTop: '0.3mm' }}>
                                        <label><input type="radio" checked={suratJalan.asuransi === true} readOnly /> Ya</label>
                                        <label><input type="radio" checked={suratJalan.asuransi === false} readOnly /> Tidak</label>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        {/* ROW 2: Pembayaran | Transport */}
                        <tr>
                            <td colSpan={2}>
                                <div className="section-header">PEMBAYARAN</div>
                                <div style={{ display: 'flex', gap: '3mm' }}>
                                    <div style={{ flex: 1 }}>
                                        <div className="label">CARA PEMBAYARAN</div>
                                        <div className="checkbox-group" style={{ marginTop: '0.5mm' }}>
                                            <label><input type="radio" checked={suratJalan.caraPembayaran === 'tunai'} readOnly /> Tunai</label>
                                            <label><input type="radio" checked={suratJalan.caraPembayaran === 'invoice'} readOnly /> Invoice</label>
                                            <label><input type="radio" checked={suratJalan.caraPembayaran === 'bank'} readOnly /> Bank</label>
                                        </div>
                                    </div>
                                    {suratJalan.catatanKhusus && (
                                        <div style={{ flex: 1 }}>
                                            <div className="label">CATATAN KHUSUS</div>
                                            <div className="value" style={{ fontSize: '6.5px' }}>{suratJalan.catatanKhusus}</div>
                                        </div>
                                    )}
                                </div>
                            </td>

                            <td>
                                <div className="section-header">TRANSPORT</div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">MOBIL</div>
                                    <div className="value">{suratJalan.nomorMobil || '-'}</div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">SOPIR</div>
                                    <div className="value">{suratJalan.namaSopir || '-'}</div>
                                </div>
                                <div style={{ marginTop: '0.5mm' }}>
                                    <div className="label">RUTE</div>
                                    <div className="value">{suratJalan.rute || '-'}</div>
                                </div>
                            </td>
                        </tr>

                        {/* ROW 3: Koli - Berat - Volume & Keterangan (TALL TABLE with more space) */}
                        <tr>
                            <td colSpan={3} style={{ height: '25mm' }}>
                                <div className="section-header" style={{ marginBottom: '1mm', color: '#dc2626' }}>
                                    4. KOLI - BERAT - VOLUME & HARGA
                                    <span style={{ float: 'right', fontSize: '6px', fontWeight: 'bold' }}>⚠️ ISI TIDAK DIPERIKSA</span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', height: 'calc(100% - 5mm)' }}>
                                    <thead>
                                        <tr style={{ fontSize: '6px', fontWeight: 'bold', background: '#f0f0f0' }}>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', width: '8%' }}>TOTAL KOLI</td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', width: '10%' }}>BERAT</td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', width: '12%' }}>PANJANG × LEBAR × TINGGI</td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', width: '10%' }}>BERAT VOLUME</td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', width: '40%' }}>KETERANGAN ISI BARANG</td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', width: '20%' }}>JUMLAH</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ fontSize: '7px', height: '100%' }}>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>
                                                {transaction.koli}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', verticalAlign: 'top' }}>
                                                {transaction.berat} {transaction.beratUnit}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', fontSize: '6.5px', verticalAlign: 'top' }}>
                                                {suratJalan.dimensi || '-'}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'center', fontSize: '6.5px', verticalAlign: 'top' }}>
                                                {suratJalan.beratVolume ? `${suratJalan.beratVolume} ${suratJalan.satuanVolume || ''}` : '-'}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', fontSize: '7px', verticalAlign: 'top' }}>
                                                {transaction.isiBarang || '-'}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '0.5mm', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>
                                                Rp {transaction.jumlah.toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>

                        {/* ROW 4: Service, Asuransi, Catatan Khusus (Manual Fill Boxes) */}
                        <tr>
                            <td colSpan={3}>
                                <div className="section-header" style={{ marginBottom: '1mm' }}>5. SERVICE, ASURANSI, PEMBAYARAN</div>
                                <div style={{ display: 'flex', gap: '2mm' }}>
                                    {/* Service */}
                                    <div style={{ flex: 1, border: '1px solid #ccc', padding: '1mm', minHeight: '12mm' }}>
                                        <div className="label" style={{ marginBottom: '0.5mm' }}>SERVICE</div>
                                        <div className="checkbox-group" style={{ fontSize: '6px' }}>
                                            <label><input type="checkbox" /> Dalam</label>
                                            <label><input type="checkbox" /> Luar</label>
                                        </div>
                                        <div style={{ marginTop: '1mm', borderBottom: '1px solid #ddd', minHeight: '3mm' }}></div>
                                    </div>

                                    {/* Asuransi */}
                                    <div style={{ flex: 1, border: '1px solid #ccc', padding: '1mm', minHeight: '12mm' }}>
                                        <div className="label" style={{ marginBottom: '0.5mm' }}>ASURANSI</div>
                                        <div className="checkbox-group" style={{ fontSize: '6px' }}>
                                            <label><input type="radio" checked={suratJalan.asuransi === true} readOnly /> Ya</label>
                                            <label><input type="radio" checked={suratJalan.asuransi === false} readOnly /> Tidak</label>
                                        </div>
                                        <div style={{ marginTop: '1mm', borderBottom: '1px solid #ddd', minHeight: '3mm' }}></div>
                                    </div>

                                    {/* Catatan */}
                                    <div style={{ flex: 1, border: '1px solid #ccc', padding: '1mm', minHeight: '12mm' }}>
                                        <div className="label" style={{ marginBottom: '0.5mm' }}>CATATAN KHUSUS</div>
                                        <div style={{ fontSize: '6px', minHeight: '8mm', borderBottom: '1px solid #ddd' }}>
                                            {suratJalan.catatanKhusus || ''}
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        {/* ROW 5: Signatures */}
                        <tr>
                            <td style={{ height: '14mm' }}>
                                <div className="section-header">6. PENGIRIM</div>
                                <div style={{ fontSize: '6px', marginTop: '0.5mm' }}>Tgl:</div>
                                <div className="signature-area">
                                    <div className="signature-line">
                                        Stempel & Nama Terang
                                    </div>
                                </div>
                                <div style={{ fontSize: '5px', marginTop: '0.5mm' }}>Jam:</div>
                            </td>

                            <td style={{ height: '14mm' }}>
                                <div className="section-header">7. PENERIMA</div>
                                <div style={{ fontSize: '6px', marginTop: '0.5mm' }}>Tgl:</div>
                                <div className="signature-area">
                                    <div className="signature-line">
                                        Stempel & Nama Terang
                                    </div>
                                </div>
                                <div style={{ fontSize: '5px', marginTop: '0.5mm' }}>Jam:</div>
                            </td>

                            <td style={{ height: '14mm' }}>
                                <div className="section-header">8. DIAMBIL OLEH</div>
                                <div style={{ fontSize: '6px', marginTop: '0.5mm' }}>Tgl:</div>
                                <div className="signature-area">
                                    <div className="signature-line">
                                        Stempel & Nama Terang
                                    </div>
                                </div>
                                <div style={{ fontSize: '5px', marginTop: '0.5mm' }}>Jam:</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}
