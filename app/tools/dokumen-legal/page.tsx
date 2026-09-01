'use client';

import { useState } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/lib/company-config';
import RouteGuard from '@/components/RouteGuard';
import { 
    Printer, 
    ArrowLeft, 
    Eye, 
    EyeOff, 
    Plus, 
    Trash2, 
    Type, 
    Layout, 
    FileSpreadsheet, 
    FileSignature,
    Ship,
    Banknote,
    CreditCard,
    FileText,
    Sparkles,
    CheckCircle2,
    ShieldCheck,
    Tag
} from 'lucide-react';

interface LostItem {
    resi: string;
    order: string;
    notes: string;
}

export type PaymentScheme = 'dp_70_30' | 'lunas_cash' | 'tf_lunas_awal';

export default function DokumenLegalPage() {
    // Layout and Display options states
    const [showKop, setShowKop] = useState<boolean>(true);
    const [showTtd, setShowTtd] = useState<boolean>(true);
    const [fontSize, setFontSize] = useState<string>('11pt');
    const [paddingSize, setPaddingSize] = useState<string>('20mm');
    const [lineHeight, setLineHeight] = useState<string>('1.5');
    const [fontFamily, setFontFamily] = useState<string>('sans');

    // Document Header Title state (Default: Kesepakatan Deal Harga Kuda 16 Ekor)
    const [documentTitle, setDocumentTitle] = useState<string>('SURAT KESEPAKATAN & RINCIAN DEAL HARGA PENGIRIMAN KHUSUS (16 EKOR KUDA)');
    
    // Active Payment Scheme (for Terms & Conditions templates)
    const [activePaymentScheme, setActivePaymentScheme] = useState<PaymentScheme | null>(null);

    // Signatory states
    const [signatoryName, setSignatoryName] = useState<string>('HILAL BAFAGIH');
    const [signatoryRole, setSignatoryRole] = useState<string>('Operational Manager');

    // Lost items table state
    const [lostItems, setLostItems] = useState<LostItem[]>([]);

    // Document Metadata state (HTML string - Default: Dimas Andika Perkasa)
    const [documentMetadata, setDocumentMetadata] = useState<string>(
        `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
            <div class="col-span-2 font-semibold">Nomor Surat</div>
            <div class="col-span-10">: 042/CCE-DEAL/KUDA/IX/2026</div>
            
            <div class="col-span-2 font-semibold">Lampiran</div>
            <div class="col-span-10">: -</div>
            
            <div class="col-span-2 font-semibold">Perihal</div>
            <div class="col-span-10 font-bold">: SURAT KESEPAKATAN RINCIAN DEAL HARGA PENGIRIMAN MUATAN KHUSUS<br/><span class="text-amber-800 font-bold text-[10pt]">[KOMODITAS: 16 EKOR KUDA | RUTE: DAGO, BANDUNG - GOWA, SULAWESI SELATAN]</span></div>
        </div>
        
        <div class="mt-4 grid grid-cols-2 gap-4 text-[10pt] bg-slate-50 p-3 rounded-lg border border-slate-300">
            <div>
                <p class="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-1.5 uppercase text-[9pt] tracking-wider">Data Pengirim (Shipper):</p>
                <p><strong>Nama:</strong> Dimas Andika Perkasa</p>
                <p><strong>Alamat:</strong> Dago, Bandung, Jawa Barat</p>
                <p><strong>No. HP / WA:</strong> +62 812-2175-8541</p>
            </div>
            <div>
                <p class="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-1.5 uppercase text-[9pt] tracking-wider">Tujuan Penerima (Consignee):</p>
                <p><strong>Alamat Tujuan:</strong> Jl. Poros Malino, Kab. Gowa, Sulawesi Selatan</p>
                <p><strong>Jenis Muatan:</strong> Hewan Hidup (Live Animals)</p>
                <p><strong>Jumlah:</strong> 16 (Enam Belas) Ekor Kuda</p>
            </div>
        </div>`
    );

    // Document main body content state (HTML string - Default: Dimas Andika Perkasa Deal)
    const [documentBody, setDocumentBody] = useState<string>(
        `<p class="mt-3">Dengan hormat,</p>
        <p class="mt-1.5">Sehubungan dengan kesepakatan kerja sama pengangkutan muatan khusus hewan hidup antara pihak Pengirim dan <strong>PT CAHAYA CARGO EXPRESS</strong> selaku penyedia jasa transportasi logistik darat &amp; laut, bersama ini kami terbitkan Surat Kesepakatan &amp; Rincian Deal Harga Pengiriman dengan perincian sebagai berikut:</p>
        
        <h3 class="font-extrabold uppercase mt-4 mb-2 text-slate-900 text-[10pt]">1. TOTAL KESEPAKATAN DEAL HARGA PENGIRIMAN</h3>
        <div class="bg-amber-50 border-2 border-amber-400 rounded-lg p-3.5 my-2">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-xs text-amber-900 font-semibold uppercase tracking-wider">Total Nilai Kesepakatan Deal (All-in Sesuai Rincian):</p>
                    <p class="text-2xl font-extrabold text-amber-950 font-mono mt-0.5">Rp 42.950.000,-</p>
                </div>
                <div class="text-right">
                    <span class="bg-amber-600 text-white text-[9pt] font-bold px-3 py-1 rounded-full uppercase">Deal Disepakati</span>
                </div>
            </div>
            <p class="text-[9pt] italic text-amber-900 mt-1.5 font-medium">Terbilang: <em>"Empat Puluh Dua Juta Sembilan Ratus Lima Puluh Ribu Rupiah"</em></p>
        </div>

        <h3 class="font-extrabold uppercase mt-4 mb-2 text-slate-900 text-[10pt]">2. RINCIAN BIAYA &amp; FASILITAS (INCLUDE / SUDAH TERMASUK)</h3>
        <table class="w-full text-left border-collapse mt-2 text-[9.5pt] border border-slate-300">
            <thead>
                <tr class="bg-slate-200 border-b border-slate-350 font-semibold text-slate-800">
                    <th class="p-2.5 border-r border-slate-300 w-[8%] text-center">No</th>
                    <th class="p-2.5 border-r border-slate-300 w-[52%]">Komponen Layanan / Fasilitas Pengiriman</th>
                    <th class="p-2.5 border-r border-slate-300 w-[20%] text-center">Status</th>
                    <th class="p-2.5 w-[20%] text-center">Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr class="border-b border-slate-300 bg-white">
                    <td class="p-2.5 border-r border-slate-300 text-center font-mono font-semibold">1.</td>
                    <td class="p-2.5 border-r border-slate-300 font-bold text-slate-900">Tiket Kapal (Penyeberangan Ferry / Ro-Ro Kargo)</td>
                    <td class="p-2.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50">✓ INCLUDE</td>
                    <td class="p-2.5 text-center text-slate-700">Pelayaran Armada Truk Kargo</td>
                </tr>
                <tr class="border-b border-slate-300 bg-white">
                    <td class="p-2.5 border-r border-slate-300 text-center font-mono font-semibold">2.</td>
                    <td class="p-2.5 border-r border-slate-300 font-bold text-slate-900">Tiket Penumpang Pengawal (Groomer / Handler Kuda)</td>
                    <td class="p-2.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50">✓ INCLUDE</td>
                    <td class="p-2.5 text-center text-slate-700">Pendampingan Selama Berlayar</td>
                </tr>
                <tr class="bg-white">
                    <td class="p-2.5 border-r border-slate-300 text-center font-mono font-semibold">3.</td>
                    <td class="p-2.5 border-r border-slate-300 font-bold text-slate-900">Cas Bagasi Muatan 16 Ekor Kuda</td>
                    <td class="p-2.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50">✓ INCLUDE</td>
                    <td class="p-2.5 text-center text-slate-700">Biaya Bagasi Muatan Kargo Laut</td>
                </tr>
            </tbody>
        </table>

        <h3 class="font-extrabold uppercase mt-4 mb-2 text-rose-900 text-[10pt]">3. KETENTUAN KHUSUS &amp; BIAYA TIDAK TERMASUK (EXCLUDE)</h3>
        <div class="bg-rose-50 border border-rose-300 rounded-lg p-3 text-[9.5pt] space-y-1.5">
            <div class="flex items-start gap-2">
                <span class="text-rose-700 font-extrabold text-sm">❌</span>
                <div>
                    <p class="font-bold text-rose-900 uppercase">TIDAK TERMASUK BIAYA KARANTINA HEWAN (EXCLUDE KARANTINA):</p>
                    <p class="text-rose-950 mt-0.5 leading-relaxed">
                        Biaya pemeriksaan kesehatan hewan, uji laboratorium, sertifikasi Balai Karantina Pertanian/Hewan (SKKH / Sertifikat Pelepasan Karantina), retribusi karantina, dan perizinan resmi dinas terkait <strong>TIDAK TERMASUK</strong> dalam nilai kesepakatan di atas dan menjadi <strong>tanggung jawab / biaya mandiri pihak PENGIRIM</strong>.
                    </p>
                </div>
            </div>
            <div class="pt-2 border-t border-rose-200 text-slate-800 text-[9pt] space-y-1">
                <p>• <strong>Pakan &amp; Perawatan Hewan:</strong> Penyediaan pakan hijauan/konsentrat, air minum, serta pemeliharaan kebersihan kuda selama masa perjalanan darat &amp; laut menjadi tanggung jawab kru pengawal (handler) yang mendampingi.</p>
                <p>• <strong>Kondisi Fisik Kuda:</strong> Seluruh kuda yang dimuat dipastikan dalam kondisi sehat, kuat, dan layak jalan (fit to travel) sebelum dinaikkan ke unit armada.</p>
            </div>
        </div>

        <h3 class="font-extrabold uppercase mt-4 mb-2 text-slate-900 text-[10pt]">4. REKENING RESMI PEMBAYARAN PERUSAHAAN</h3>
        <div class="space-y-1.5 text-[9.5pt]">
            <p>Pembayaran ditransfer langsung ke Rekening Resmi PT CAHAYA CARGO EXPRESS:</p>
            <div class="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-300 p-2.5 rounded text-[9pt]">
                <div class="border-r border-slate-300 pr-2">
                    <p class="font-bold text-blue-900">BANK BCA</p>
                    <p class="font-mono font-bold text-[10pt] text-slate-900">1870444342</p>
                    <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                </div>
                <div class="border-r border-slate-300 pr-2">
                    <p class="font-bold text-blue-800">BANK BRI</p>
                    <p class="font-mono font-bold text-[10pt] text-slate-900">0328 0107 3891 501</p>
                    <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                </div>
                <div>
                    <p class="font-bold text-amber-900">BANK MANDIRI</p>
                    <p class="font-mono font-bold text-[10pt] text-slate-900">14000 2408 7851</p>
                    <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                </div>
            </div>
        </div>

        <p class="mt-4 text-[9.5pt]">Demikian Surat Kesepakatan &amp; Rincian Deal Harga ini dibuat dengan sebenarnya dan disetujui bersama untuk dipergunakan sebagai dasar pelaksanaan pengiriman operasional muatan.</p>
        
        <div class="mt-6 text-[9.5pt]">
            <p class="mb-3">Dibuat pada tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <div class="flex justify-between items-start">
                <div class="text-center w-[45%]">
                    <p class="font-bold">Pihak Transporter,</p>
                    <p class="font-bold text-slate-900">PT CAHAYA CARGO EXPRESS</p>
                    <p class="text-slate-600 text-[8.5pt]">(Penyedia Jasa Pengangkutan)</p>
                    <div class="h-16"></div>
                    <p class="font-bold underline">( HILAL BAFAGIH )</p>
                    <p class="text-[8.5pt]">Operational Manager</p>
                </div>
                <div class="text-center w-[45%]">
                    <p class="font-bold">Pihak Pengirim (Shipper),</p>
                    <p class="font-bold text-slate-900">PENGIRIM MUATAN KUDA</p>
                    <p class="text-slate-600 text-[8.5pt]">(Dago, Bandung)</p>
                    <div class="h-16"></div>
                    <p class="font-bold underline">( DIMAS ANDIKA PERKASA )</p>
                    <p class="text-[8.5pt]">Pengirim / Pemilik Muatan</p>
                </div>
            </div>
        </div>`
    );

    // Content after the table state (HTML string)
    const [documentBodyEnd, setDocumentBodyEnd] = useState<string>('');

    // Dynamic styles mappings
    const fontFamilies: { [key: string]: string } = {
        serif: "Georgia, 'Times New Roman', Times, serif",
        sans: "Arial, Helvetica, sans-serif",
        mono: "Courier New, Courier, monospace"
    };

    // Table operations
    const handleCellChange = (index: number, field: keyof LostItem, value: string) => {
        const updated = [...lostItems];
        updated[index][field] = value;
        setLostItems(updated);
    };

    const addRow = () => {
        setLostItems([...lostItems, { resi: 'SPXID...', order: 'TO...', notes: '-' }]);
    };

    const removeRow = () => {
        if (lostItems.length > 0) {
            setLostItems(lostItems.slice(0, -1));
        }
    };

    // Helper: Generate Payment Scheme HTML
    const getPaymentSchemeHTML = (scheme: PaymentScheme): string => {
        if (scheme === 'dp_70_30') {
            return `
            <div class="bg-slate-50 border border-slate-300 rounded-md p-3.5 my-2 text-[9.5pt]">
                <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-300">
                    <span class="bg-blue-600 text-white font-bold text-[8pt] px-2 py-0.5 rounded">OPSI A</span>
                    <p class="font-bold text-slate-900 text-[10pt]">Skema: DP 70% KAPAL BERANGKAT + 30% KAPAL SANDAR</p>
                </div>
                <ol class="list-decimal pl-5 space-y-2">
                    <li>
                        <strong>Tahap I - Uang Muka / Down Payment (DP 70%):</strong><br/>
                        PENGIRIM wajib membayar DP sebesar <strong>70% (Tujuh Puluh Persen)</strong> dari total tagihan ongkos angkut paling lambat <strong>1 x 24 Jam</strong> setelah kapal selesai pemuatan (loading) dan telah resmi berangkat / berlayar (sailing) dari pelabuhan asal (dibuktikan dengan Surat Perintah Berlayar / SPB atau Berita Acara Keberangkatan Kapal).
                    </li>
                    <li>
                        <strong>Tahap II - Pelunasan Sisa Tagihan (Pelunasan 30%):</strong><br/>
                        PENGIRIM wajib melunasi sisa tagihan sebesar <strong>30% (Tiga Puluh Persen)</strong> pada saat kapal telah tiba dan sandar (berthing) di dermaga pelabuhan tujuan, <strong>SEBELUM</strong> proses pembongkaran kargo dilakukan dan <strong>SEBELUM</strong> penyerahan dokumen serah terima muatan / Delivery Order (DO) kepada pihak penerima (Consignee).
                    </li>
                </ol>
                <table class="w-full text-left border-collapse mt-3 text-[9pt] border border-slate-300">
                    <thead>
                        <tr class="bg-slate-200 border-b border-slate-300 font-semibold text-slate-800">
                            <th class="p-2 border-r border-slate-300 text-center w-[12%]">Termin</th>
                            <th class="p-2 border-r border-slate-300 w-[18%] text-center">Persentase</th>
                            <th class="p-2 border-r border-slate-300 w-[38%]">Waktu Penagihan</th>
                            <th class="p-2 w-[32%]">Syarat Rilis / Pelaksanaan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-300 bg-white">
                            <td class="p-2 border-r border-slate-300 text-center font-bold">Termin I</td>
                            <td class="p-2 border-r border-slate-300 text-center font-bold text-blue-800">DP 70%</td>
                            <td class="p-2 border-r border-slate-300">Saat Kapal Selesai Muat &amp; Berangkat (Sailing)</td>
                            <td class="p-2">Invoice DP 70% &amp; Konfirmasi SPB Keberangkatan</td>
                        </tr>
                        <tr class="bg-white">
                            <td class="p-2 border-r border-slate-300 text-center font-bold">Termin II</td>
                            <td class="p-2 border-r border-slate-300 text-center font-bold text-emerald-800">Pelunasan 30%</td>
                            <td class="p-2 border-r border-slate-300">Saat Kapal Tiba &amp; Sandar di Pelabuhan Tujuan</td>
                            <td class="p-2 font-bold text-rose-700">Wajib Lunas SEBELUM Bongkar &amp; Rilis DO</td>
                        </tr>
                    </tbody>
                </table>
            </div>`;
        } else if (scheme === 'lunas_cash') {
            return `
            <div class="bg-slate-50 border border-slate-300 rounded-md p-3.5 my-2 text-[9.5pt]">
                <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-300">
                    <span class="bg-emerald-600 text-white font-bold text-[8pt] px-2 py-0.5 rounded">OPSI B</span>
                    <p class="font-bold text-slate-900 text-[10pt]">Skema: LUNAS CASH (PEMBAYARAN TUNAI 100% DI AWAL)</p>
                </div>
                <ol class="list-decimal pl-5 space-y-2">
                    <li>
                        <strong>Pembayaran Tunai 100% di Muka (Cash on Order):</strong><br/>
                        PENGIRIM wajib menyelesaikan pembayaran seluruh ongkos angkut secara <strong>LUNAS 100% TUNAI (Cash)</strong> di loket kasir / kantor operasional PT CAHAYA CARGO EXPRESS pada saat penyerahan barang / penimbangan muatan di gudang sebelum kargo dimuat ke kapal.
                    </li>
                    <li>
                        <strong>Bukti Kwitansi Resmi Pembayaran:</strong><br/>
                        Pembayaran tunai dinyatakan sah dan terverifikasi setelah diterbitkannya Kwitansi Resmi bermeterai / cap basah kasir PT CAHAYA CARGO EXPRESS yang menjadi dasar penerbitan Surat Jalan Muat.
                    </li>
                </ol>
                <table class="w-full text-left border-collapse mt-3 text-[9pt] border border-slate-300">
                    <thead>
                        <tr class="bg-slate-200 border-b border-slate-300 font-semibold text-slate-800">
                            <th class="p-2 border-r border-slate-300 text-center w-[15%]">Metode</th>
                            <th class="p-2 border-r border-slate-300 w-[18%] text-center">Persentase</th>
                            <th class="p-2 border-r border-slate-300 w-[37%]">Waktu Pembayaran</th>
                            <th class="p-2 w-[30%]">Status Dokumen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="bg-white">
                            <td class="p-2 border-r border-slate-300 text-center font-bold">Tunai (Cash)</td>
                            <td class="p-2 border-r border-slate-300 text-center font-bold text-emerald-800">100% LUNAS</td>
                            <td class="p-2 border-r border-slate-300">Saat Penyerahan Barang di Gudang Asal</td>
                            <td class="p-2 font-bold text-emerald-700">Kwitansi Lunas Terbit di Tempat</td>
                        </tr>
                    </tbody>
                </table>
            </div>`;
        } else {
            return `
            <div class="bg-slate-50 border border-slate-300 rounded-md p-3.5 my-2 text-[9.5pt]">
                <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-300">
                    <span class="bg-indigo-600 text-white font-bold text-[8pt] px-2 py-0.5 rounded">OPSI C</span>
                    <p class="font-bold text-slate-900 text-[10pt]">Skema: TRANSFER BANK LUNAS DI AWAL (100% PRE-PAYMENT)</p>
                </div>
                <ol class="list-decimal pl-5 space-y-2">
                    <li>
                        <strong>Transfer Bank Lunas 100% di Muka (Full Pre-Payment):</strong><br/>
                        PENGIRIM wajib menyelesaikan seluruh tagihan ongkos angkut secara <strong>LUNAS 100% via Transfer Bank</strong> ke rekening resmi PT CAHAYA CARGO EXPRESS sebelum kapal diberangkatkan (sebelum batas closing manifest muatan kapal).
                    </li>
                    <li>
                        <strong>Konfirmasi &amp; Validasi Dana Masuk:</strong><br/>
                        Bukti transfer bank wajib dikirimkan dan divalidasi oleh Tim Finance CCE. Resi pengiriman, Surat Jalan, dan Instruksi Rilis hanya akan diproses setelah dana terverifikasi efektif masuk ke rekening perusahaan.
                    </li>
                </ol>
                <table class="w-full text-left border-collapse mt-3 text-[9pt] border border-slate-300">
                    <thead>
                        <tr class="bg-slate-200 border-b border-slate-300 font-semibold text-slate-800">
                            <th class="p-2 border-r border-slate-300 text-center w-[15%]">Metode</th>
                            <th class="p-2 border-r border-slate-300 w-[18%] text-center">Persentase</th>
                            <th class="p-2 border-r border-slate-300 w-[37%]">Waktu Pembayaran</th>
                            <th class="p-2 w-[30%]">Syarat Rilis Muatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="bg-white">
                            <td class="p-2 border-r border-slate-300 text-center font-bold">Transfer Bank</td>
                            <td class="p-2 border-r border-slate-300 text-center font-bold text-indigo-800">100% LUNAS</td>
                            <td class="p-2 border-r border-slate-300">Sebelum Kapal Berangkat (Closing Manifest)</td>
                            <td class="p-2 font-bold text-indigo-700">Dana Efektif Masuk Rekening CCE</td>
                        </tr>
                    </tbody>
                </table>
            </div>`;
        }
    };

    // Helper: Build Full Terms & Conditions Document
    const buildTermsCondDocument = (scheme: PaymentScheme) => {
        const schemeTitles: Record<PaymentScheme, string> = {
            dp_70_30: 'DP 70% KAPAL BERANGKAT + 30% KAPAL SANDAR',
            lunas_cash: 'LUNAS CASH (PEMBAYARAN TUNAI DI AWAL)',
            tf_lunas_awal: 'TRANSFER BANK LUNAS DI AWAL (PRE-PAYMENT)',
        };

        const schemeLabel = schemeTitles[scheme];
        const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const metadata = `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
            <div class="col-span-2 font-semibold">Nomor</div>
            <div class="col-span-10">: 035/CCE-TC/VIII/2026</div>
            
            <div class="col-span-2 font-semibold">Lampiran</div>
            <div class="col-span-10">: -</div>
            
            <div class="col-span-2 font-semibold">Perihal</div>
            <div class="col-span-10 font-bold">: SYARAT &amp; KETENTUAN PENGIRIMAN CARGO DAN SKEMA PEMBAYARAN (TERMS &amp; CONDITIONS)<br/><span class="text-slate-700 font-semibold text-[9.5pt]">[SKEMA PEMBAYARAN: ${schemeLabel}]</span></div>
        </div>
        <div class="mt-5 text-[10.5pt]">
            <p>Kepada Yth,</p>
            <p class="font-bold">Pimpinan / Management &amp; Bagian Keuangan</p>
            <p class="font-bold text-slate-900">[NAMA PERUSAHAAN / MITRA PENGIRIM]</p>
            <p class="text-slate-700">Kedudukan sebagai: PENGIRIM (SHIPPER / CUSTOMER)</p>
            <p>Di Tempat</p>
        </div>`;

        const paymentClause = getPaymentSchemeHTML(scheme);

        const body = `<p class="mt-4">Dengan hormat,</p>
        <p class="mt-2">Dokumen ini memuat ketentuan hukum operasional serta syarat dan ketentuan pembayaran (<strong>Terms &amp; Conditions</strong>) yang berlaku mengikat antara <strong>PT CAHAYA CARGO EXPRESS</strong> (selaku PENYEDIA JASA PENGANGKUTAN / TRANSPORTER) dan <strong>PENGIRIM (SHIPPER / CUSTOMER)</strong> dalam pelaksanaan pengangkutan kargo logistik via jalur laut / darat / udara sebagai berikut:</p>
        
        <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">1. KETENTUAN OPERASIONAL MUATAN &amp; PERHITUNGAN BERAT</h3>
        <div class="space-y-2 text-[9.5pt]">
            <p><strong>a. Dasar Perhitungan Berat Chargeable (Actual vs Volume):</strong><br/>
            Tarif ongkos angkut dihitung berdasarkan berat aktual timbangan (Actual Weight) atau berat volumetrik (Volume Weight) mana yang bernilai lebih tinggi. Rumus konversi volumetrik resmi pengiriman kargo laut/darat: <strong>(Panjang x Lebar x Tinggi dalam cm) / 4.000 = Berat Volumetrik (Kg)</strong>.</p>
            
            <p><strong>b. Kargo Berbahaya &amp; Barang Terlarang (Dangerous &amp; Prohibited Goods):</strong><br/>
            PENGIRIM dilarang keras memuat barang-barang berbahaya (bahan peledak, mudah terbakar, zat kimia berbahaya/beracun tanpa sertifikat MSDS resmi), senjata api/tajam, narkotika/obat-obatan terlarang, barang selundupan yang melanggar hukum, serta hewan hidup tanpa sertifikasi karantina. Segala risiko hukum, sanksi pidana/perdata, dan ganti rugi akibat pemalsuan keterangan manifes barang menjadi tanggung jawab mutlak PENGIRIM.</p>
            
            <p><strong>c. Standar Kemasan (Packaging):</strong><br/>
            PENGIRIM bertanggung jawab penuh atas kekuatan dan kelayakan kemasan barang. Barang pecah belah, cairan, mesin/peralatan elektronik wajib dikemas peti kayu (wooden crate) dan dilapisi plastik kedap air (waterproof wrapping).</p>
        </div>

        <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">2. SKEMA &amp; SYARAT PEMBAYARAN (PAYMENT TERMS)</h3>
        ${paymentClause}

        <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">3. REKENING RESMI PEMBAYARAN PERUSAHAAN</h3>
        <div class="space-y-2 text-[9.5pt]">
            <p>Seluruh pembayaran via Transfer Bank wajib ditujukan ke Rekening Bank Resmi PT CAHAYA CARGO EXPRESS:</p>
            <div class="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-300 p-2.5 rounded text-[9pt]">
                <div class="border-r border-slate-300 pr-2">
                    <p class="font-bold text-blue-900">BANK BCA</p>
                    <p class="font-mono font-bold text-[10pt] text-slate-900">1870444342</p>
                    <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                </div>
                <div class="border-r border-slate-300 pr-2">
                    <p class="font-bold text-blue-800">BANK BRI</p>
                    <p class="font-mono font-bold text-[10pt] text-slate-900">0328 0107 3891 501</p>
                    <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                </div>
                <div>
                    <p class="font-bold text-amber-900">BANK MANDIRI</p>
                    <p class="font-mono font-bold text-[10pt] text-slate-900">14000 2408 7851</p>
                    <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                </div>
            </div>
            <p class="text-[8.5pt] italic text-rose-700 font-semibold">* Peringatan: Pembayaran di luar nomor rekening resmi di atas dinyatakan TIDAK SAH dan Transporter dibebaskan dari segala tuntutan kerugian.</p>
        </div>

        <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">4. HAK RETENSI, PENAHANAN MUATAN &amp; DEMURRAGE (LIEN ON CARGO)</h3>
        <div class="space-y-2 text-[9.5pt]">
            <p><strong>a. Hak Retensi Pengangkut (Lien on Cargo):</strong><br/>
            Apabila PENGIRIM lalai, menunda, atau belum menyelesaikan kewajiban pembayaran sesuai termin yang disepakati (khususnya pelunasan 30% saat kapal sandar atau sebelum rilis dokumen), maka PT CAHAYA CARGO EXPRESS berhak penuh secara hukum untuk menjalankan <strong>HAK RETENSI</strong> dengan <strong>MENAHAN</strong> seluruh atau sebagian muatan kargo, Delivery Order (DO), Surat Jalan asli, serta menunda pembongkaran kargo sampai seluruh tagihan dilunasi 100%.</p>
            
            <p><strong>b. Biaya Penumpukan &amp; Demurrage:</strong><br/>
            Segala timbulnya biaya penumpukan di dermaga/gudang transit pelabuhan (storage charges), biaya denda kontainer/demurrage truk, serta biaya pengawalan tambahan yang timbul akibat penahanan kargo karena keterlambatan pembayaran ditanggung sepenuhnya oleh PENGIRIM.</p>
        </div>

        <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">5. ASURANSI, KLAIM KERUSAKAN / KEHILANGAN &amp; FORCE MAJEURE</h3>
        <div class="space-y-2 text-[9.5pt]">
            <p><strong>a. Asuransi Kargo (Marine Cargo Insurance):</strong><br/>
            Kargo bernilai tinggi sangat dianjurkan diasuransikan. Premi asuransi dan nilai pertanggungan disepakati secara tertulis sebelum pemuatan barang.</p>
            
            <p><strong>b. Prosedur Klaim:</strong><br/>
            Segala bentuk komplain atau klaim atas selisih fisik atau kerusakan barang wajib dituangkan dalam <strong>Berita Acara Resmi (Discrepancy Report)</strong> yang ditandatangani bersama di lokasi tujuan saat pembongkaran berlangsung, maksimal <strong>1 x 24 Jam</strong> sejak kargo diserahterimakan. Klaim tidak berlaku apabila barang telah dipindahkan atau keluar dari area bongkar tanpa Berita Acara tertulis.</p>
            
            <p><strong>c. Keadaan Kahar (Force Majeure):</strong><br/>
            Pengangkut dibebaskan dari tuntutan ganti rugi, penalti, atau kompensasi keterlambatan yang disebabkan oleh Keadaan Kahar (Force Majeure), termasuk namun tidak terbatas pada cuaca buruk laut/badai gelombang tinggi, kecelakaan pelayaran di laut lepas, penutupan pelabuhan oleh Otoritas Syahbandar, huru-hara, perang, atau bencana alam di luar kendali wajar manusia.</p>
        </div>

        <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">6. PERSETUJUAN &amp; PENUTUP</h3>
        <p class="text-[9.5pt]">Dokumen Terms &amp; Conditions ini berkekuatan hukum tetap dan mengikat kedua belah pihak sejak disetujui, ditandatangani, atau sejak penyerahan kargo untuk diberangkatkan.</p>
        
        <div class="mt-8 text-[9.5pt]">
            <p class="mb-4">Surabaya, ${todayFormatted}</p>
            <div class="flex justify-between items-start">
                <div class="text-center w-[45%]">
                    <p class="font-bold">Pihak Pengangkut (Transporter),</p>
                    <p class="font-bold text-slate-900">PT CAHAYA CARGO EXPRESS</p>
                    <p class="text-slate-600 text-[8.5pt]">(Penyedia Jasa Pengangkutan)</p>
                    <div class="h-20"></div>
                    <p class="font-bold underline">( HILAL BAFAGIH )</p>
                    <p class="text-[8.5pt]">Operational Manager</p>
                </div>
                <div class="text-center w-[45%]">
                    <p class="font-bold">Menyetujui &amp; Mengikat Diri,</p>
                    <p class="font-bold text-slate-900">[NAMA PERUSAHAAN / SHIPPER]</p>
                    <p class="text-slate-600 text-[8.5pt]">(Pengirim / Customer)</p>
                    <div class="h-20"></div>
                    <p class="font-bold underline">( ________________________ )</p>
                    <p class="text-[8.5pt]">Nama Jelas &amp; Jabatan</p>
                </div>
            </div>
        </div>`;

        return {
            title: 'TERMS & CONDITIONS (SYARAT & KETENTUAN) LAYANAN PENGIRIMAN CARGO & SKEMA PEMBAYARAN',
            metadata,
            body,
            bodyEnd: ''
        };
    };

    // Load Terms & Conditions Template
    const loadTermsCondTemplate = (scheme: PaymentScheme) => {
        const schemeNames: Record<PaymentScheme, string> = {
            dp_70_30: 'DP 70% Kapal Berangkat + 30% Kapal Sandar',
            lunas_cash: 'Lunas Cash (Tunai di Awal)',
            tf_lunas_awal: 'Transfer Bank Lunas di Awal (Pre-Payment)',
        };

        if (confirm(`Reset dokumen ke template Terms & Conditions (${schemeNames[scheme]})? Perubahan teks yang belum dicetak akan diganti.`)) {
            const doc = buildTermsCondDocument(scheme);
            setDocumentTitle(doc.title);
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);
            setDocumentMetadata(doc.metadata);
            setDocumentBody(doc.body);
            setDocumentBodyEnd(doc.bodyEnd);
            setActivePaymentScheme(scheme);
        }
    };

    // Switch Payment Scheme seamlessly on active T&C document
    const switchTermsPaymentScheme = (newScheme: PaymentScheme) => {
        const doc = buildTermsCondDocument(newScheme);
        setDocumentMetadata(doc.metadata);
        setDocumentBody(doc.body);
        setActivePaymentScheme(newScheme);
    };

    // Load Deal Harga Muatan Kuda 16 Ekor (Dimas Andika Perkasa - Bandung ke Gowa)
    const loadDealKudaTemplate = () => {
        if (confirm("Muat dokumen resmi Kesepakatan Deal Harga Pengiriman 16 Ekor Kuda (Dimas Andika Perkasa)?")) {
            setActivePaymentScheme(null);
            setDocumentTitle('SURAT KESEPAKATAN & RINCIAN DEAL HARGA PENGIRIMAN KHUSUS (16 EKOR KUDA)');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);

            const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">Nomor Surat</div>
                    <div class="col-span-10">: 042/CCE-DEAL/KUDA/IX/2026</div>
                    
                    <div class="col-span-2 font-semibold">Lampiran</div>
                    <div class="col-span-10">: -</div>
                    
                    <div class="col-span-2 font-semibold">Perihal</div>
                    <div class="col-span-10 font-bold">: SURAT KESEPAKATAN RINCIAN DEAL HARGA PENGIRIMAN MUATAN KHUSUS<br/><span class="text-amber-800 font-bold text-[10pt]">[KOMODITAS: 16 EKOR KUDA | RUTE: DAGO, BANDUNG - GOWA, SULAWESI SELATAN]</span></div>
                </div>
                
                <div class="mt-4 grid grid-cols-2 gap-4 text-[10pt] bg-slate-50 p-3 rounded-lg border border-slate-300">
                    <div>
                        <p class="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-1.5 uppercase text-[9pt] tracking-wider">Data Pengirim (Shipper):</p>
                        <p><strong>Nama:</strong> Dimas Andika Perkasa</p>
                        <p><strong>Alamat:</strong> Dago, Bandung, Jawa Barat</p>
                        <p><strong>No. HP / WA:</strong> +62 812-2175-8541</p>
                    </div>
                    <div>
                        <p class="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-1.5 uppercase text-[9pt] tracking-wider">Tujuan Penerima (Consignee):</p>
                        <p><strong>Alamat Tujuan:</strong> Jl. Poros Malino, Kab. Gowa, Sulawesi Selatan</p>
                        <p><strong>Jenis Muatan:</strong> Hewan Hidup (Live Animals)</p>
                        <p><strong>Jumlah:</strong> 16 (Enam Belas) Ekor Kuda</p>
                    </div>
                </div>`
            );

            setDocumentBody(
                `<p class="mt-3">Dengan hormat,</p>
                <p class="mt-1.5">Sehubungan dengan kesepakatan kerja sama pengangkutan muatan khusus hewan hidup antara pihak Pengirim dan <strong>PT CAHAYA CARGO EXPRESS</strong> selaku penyedia jasa transportasi logistik darat &amp; laut, bersama ini kami terbitkan Surat Kesepakatan &amp; Rincian Deal Harga Pengiriman dengan perincian sebagai berikut:</p>
                
                <h3 class="font-extrabold uppercase mt-4 mb-2 text-slate-900 text-[10pt]">1. TOTAL KESEPAKATAN DEAL HARGA PENGIRIMAN</h3>
                <div class="bg-amber-50 border-2 border-amber-400 rounded-lg p-3.5 my-2">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-xs text-amber-900 font-semibold uppercase tracking-wider">Total Nilai Kesepakatan Deal (All-in Sesuai Rincian):</p>
                            <p class="text-2xl font-extrabold text-amber-950 font-mono mt-0.5">Rp 42.950.000,-</p>
                        </div>
                        <div class="text-right">
                            <span class="bg-amber-600 text-white text-[9pt] font-bold px-3 py-1 rounded-full uppercase">Deal Disepakati</span>
                        </div>
                    </div>
                    <p class="text-[9pt] italic text-amber-900 mt-1.5 font-medium">Terbilang: <em>"Empat Puluh Dua Juta Sembilan Ratus Lima Puluh Ribu Rupiah"</em></p>
                </div>

                <h3 class="font-extrabold uppercase mt-4 mb-2 text-slate-900 text-[10pt]">2. RINCIAN BIAYA &amp; FASILITAS (INCLUDE / SUDAH TERMASUK)</h3>
                <table class="w-full text-left border-collapse mt-2 text-[9.5pt] border border-slate-300">
                    <thead>
                        <tr class="bg-slate-200 border-b border-slate-350 font-semibold text-slate-800">
                            <th class="p-2.5 border-r border-slate-300 w-[8%] text-center">No</th>
                            <th class="p-2.5 border-r border-slate-300 w-[52%]">Komponen Layanan / Fasilitas Pengiriman</th>
                            <th class="p-2.5 border-r border-slate-300 w-[20%] text-center">Status</th>
                            <th class="p-2.5 w-[20%] text-center">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-300 bg-white">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-semibold">1.</td>
                            <td class="p-2.5 border-r border-slate-300 font-bold text-slate-900">Tiket Kapal (Penyeberangan Ferry / Ro-Ro Kargo)</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50">✓ INCLUDE</td>
                            <td class="p-2.5 text-center text-slate-700">Pelayaran Armada Truk Kargo</td>
                        </tr>
                        <tr class="border-b border-slate-300 bg-white">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-semibold">2.</td>
                            <td class="p-2.5 border-r border-slate-300 font-bold text-slate-900">Tiket Penumpang Pengawal (Groomer / Handler Kuda)</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50">✓ INCLUDE</td>
                            <td class="p-2.5 text-center text-slate-700">Pendampingan Selama Berlayar</td>
                        </tr>
                        <tr class="bg-white">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-semibold">3.</td>
                            <td class="p-2.5 border-r border-slate-300 font-bold text-slate-900">Cas Bagasi Muatan 16 Ekor Kuda</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50">✓ INCLUDE</td>
                            <td class="p-2.5 text-center text-slate-700">Biaya Bagasi Muatan Kargo Laut</td>
                        </tr>
                    </tbody>
                </table>

                <h3 class="font-extrabold uppercase mt-4 mb-2 text-rose-900 text-[10pt]">3. KETENTUAN KHUSUS &amp; BIAYA TIDAK TERMASUK (EXCLUDE)</h3>
                <div class="bg-rose-50 border border-rose-300 rounded-lg p-3 text-[9.5pt] space-y-1.5">
                    <div class="flex items-start gap-2">
                        <span class="text-rose-700 font-extrabold text-sm">❌</span>
                        <div>
                            <p class="font-bold text-rose-900 uppercase">TIDAK TERMASUK BIAYA KARANTINA HEWAN (EXCLUDE KARANTINA):</p>
                            <p class="text-rose-950 mt-0.5 leading-relaxed">
                                Biaya pemeriksaan kesehatan hewan, uji laboratorium, sertifikasi Balai Karantina Pertanian/Hewan (SKKH / Sertifikat Pelepasan Karantina), retribusi karantina, dan perizinan resmi dinas terkait <strong>TIDAK TERMASUK</strong> dalam nilai kesepakatan di atas dan menjadi <strong>tanggung jawab / biaya mandiri pihak PENGIRIM</strong>.
                            </p>
                        </div>
                    </div>
                    <div class="pt-2 border-t border-rose-200 text-slate-800 text-[9pt] space-y-1">
                        <p>• <strong>Pakan &amp; Perawatan Hewan:</strong> Penyediaan pakan hijauan/konsentrat, air minum, serta pemeliharaan kebersihan kuda selama masa perjalanan darat &amp; laut menjadi tanggung jawab kru pengawal (handler) yang mendampingi.</p>
                        <p>• <strong>Kondisi Fisik Kuda:</strong> Seluruh kuda yang dimuat dipastikan dalam kondisi sehat, kuat, dan layak jalan (fit to travel) sebelum dinaikkan ke unit armada.</p>
                    </div>
                </div>

                <h3 class="font-extrabold uppercase mt-4 mb-2 text-slate-900 text-[10pt]">4. REKENING RESMI PEMBAYARAN PERUSAHAAN</h3>
                <div class="space-y-1.5 text-[9.5pt]">
                    <p>Pembayaran ditransfer langsung ke Rekening Resmi PT CAHAYA CARGO EXPRESS:</p>
                    <div class="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-300 p-2.5 rounded text-[9pt]">
                        <div class="border-r border-slate-300 pr-2">
                            <p class="font-bold text-blue-900">BANK BCA</p>
                            <p class="font-mono font-bold text-[10pt] text-slate-900">1870444342</p>
                            <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                        </div>
                        <div class="border-r border-slate-300 pr-2">
                            <p class="font-bold text-blue-800">BANK BRI</p>
                            <p class="font-mono font-bold text-[10pt] text-slate-900">0328 0107 3891 501</p>
                            <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                        </div>
                        <div>
                            <p class="font-bold text-amber-900">BANK MANDIRI</p>
                            <p class="font-mono font-bold text-[10pt] text-slate-900">14000 2408 7851</p>
                            <p class="text-slate-600 text-[8pt]">a.n. MARTINI</p>
                        </div>
                    </div>
                </div>

                <p class="mt-4 text-[9.5pt]">Demikian Surat Kesepakatan &amp; Rincian Deal Harga ini dibuat dengan sebenarnya dan disetujui bersama untuk dipergunakan sebagai dasar pelaksanaan pengiriman operasional muatan.</p>
                
                <div class="mt-6 text-[9.5pt]">
                    <p class="mb-3">Dibuat pada tanggal: ${todayFormatted}</p>
                    <div class="flex justify-between items-start">
                        <div class="text-center w-[45%]">
                            <p class="font-bold">Pihak Transporter,</p>
                            <p class="font-bold text-slate-900">PT CAHAYA CARGO EXPRESS</p>
                            <p class="text-slate-600 text-[8.5pt]">(Penyedia Jasa Pengangkutan)</p>
                            <div class="h-16"></div>
                            <p class="font-bold underline">( HILAL BAFAGIH )</p>
                            <p class="text-[8.5pt]">Operational Manager</p>
                        </div>
                        <div class="text-center w-[45%]">
                            <p class="font-bold">Pihak Pengirim (Shipper),</p>
                            <p class="font-bold text-slate-900">PENGIRIM MUATAN KUDA</p>
                            <p class="text-slate-600 text-[8.5pt]">(Dago, Bandung)</p>
                            <div class="h-16"></div>
                            <p class="font-bold underline">( DIMAS ANDIKA PERKASA )</p>
                            <p class="text-[8.5pt]">Pengirim / Pemilik Muatan</p>
                        </div>
                    </div>
                </div>`
            );
            setDocumentBodyEnd('');
        }
    };

    // Reset to Surat Pernyataan Komitmen Bersama
    const loadKomitmenTemplate = () => {
        if (confirm("Reset dokumen ke template Surat Pernyataan Komitmen Bersama? Perubahan yang belum dicetak akan hilang.")) {
            setActivePaymentScheme(null);
            setDocumentTitle('SURAT PERNYATAAN KOMITMEN BERSAMA');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">No. Surat</div>
                    <div class="col-span-6">: CCE/DIR-OPS/SPK/VI/2026</div>
                    <div class="col-span-4 text-right font-semibold text-[10pt]">Surabaya, 09 Juni 2026</div>
                    
                    <div class="col-span-2 font-semibold">Sifat</div>
                    <div class="col-span-10">: Penting / Segera</div>
                    
                    <div class="col-span-2 font-semibold">Lampiran</div>
                    <div class="col-span-10">: -</div>
                    
                    <div class="col-span-2 font-semibold">Hal</div>
                    <div class="col-span-10 font-bold">: Pernyataan Komitmen Evaluasi Operasional dan Peningkatan Sistem Keamanan Area Kerja</div>
                </div>
                <div class="mt-5 text-[10.5pt]">
                    <p>Kepada Yth.</p>
                    <p class="font-bold">Pimpinan Manajemen PT DUTA HANTARAN SURABAYA (DHS)</p>
                    <p>Di Tempat</p>
                </div>`
            );
            setDocumentBody(
                `<p class="mt-4">Dengan hormat,</p>
                <p class="mt-2">Sehubungan dengan hasil evaluasi bersama terkait dinamika operasional logistik dan sebagai bentuk komitmen nyata dari Cahaya Cargo (CCE) dalam menjaga kualitas layanan, keamanan barang, serta kelangsungan kerja sama strategis dengan PT Duta Hantaran Surabaya (DHS), kami selaku manajemen Cahaya Cargo (CCE) dengan ini menyatakan kesanggupan, komitmen, dan rencana aksi nyata untuk melakukan evaluasi operasional serta peningkatan sistem keamanan di seluruh area kerja kami, khususnya pada Cabang Surabaya dan Cabang Makassar.</p>
                <p class="mt-2">Adapun langkah-langkah strategis dan taktis yang akan segera kami terapkan adalah sebagai berikut:</p>
                
                <ol class="list-decimal pl-5 space-y-4 mt-4">
                    <li>
                        <strong>Peningkatan Sistem Pemantauan Visual (Instalasi &amp; Optimalisasi CCTV)</strong>
                        <p class="mt-1"><strong>Komitmen:</strong> Cahaya Cargo (CCE) akan melakukan penambahan unit kamera CCTV (Closed-Circuit Television) berspesifikasi tinggi (high-definition) di berbagai sudut krusial yang memerlukan pemantauan lebih ketat (blind spots), baik di Cabang Surabaya maupun Cabang Makassar.</p>
                        <p class="mt-1"><strong>Area Fokus:</strong> Area pemuatan (loading), pembongkaran (unloading), penempatan sementara (staging area), serta jalur keluar-masuk armada truk pengangkut.</p>
                        <p class="mt-1"><strong>Sistem Manajemen Data:</strong> Kami juga berkomitmen meningkatkan kapasitas penyimpanan data rekaman (storage backup) serta melakukan pemeliharaan berkala secara rutin guna memastikan fungsi pengawasan visual berjalan tanpa kendala 24/7.</p>
                    </li>
                    <li>
                        <strong>Penerapan Sistem Pemindaian Digital (Scanning System) yang Terintegrasi</strong>
                        <p class="mt-1"><strong>Komitmen:</strong> Guna meminimalkan risiko selisih perhitungan koli dan human error, Cahaya Cargo (CCE) akan menerapkan sistem pemindaian barcode/resi (scanning system) secara ketat untuk setiap proses bongkar dan muat barang milik DHS di gudang CCE.</p>
                        <p class="mt-1"><strong>Mekanisme Kerja:</strong></p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li>Setiap paket/koli yang masuk atau keluar dari unit transportasi wajib melalui proses scanning untuk memastikan kecocokan data manifest fisik dengan sistem digital secara real-time.</li>
                            <li>Laporan hasil scanning (bongkar/muat) akan dikoordinasikan secara transparan kepada pihak pengawas DHS sebagai dasar serah terima barang yang sah.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Penugasan Personel Pengawas Khusus (Dedicated Operational Supervisor)</strong>
                        <p class="mt-1"><strong>Komitmen:</strong> Cahaya Cargo (CCE) akan menugaskan staf khusus yang berdedikasi penuh untuk mengawasi seluruh alur operasional barang milik DHS, mulai dari penanganan barang di gudang hingga proses pemuatan ke armada.</p>
                        <p class="mt-1"><strong>Tanggung Jawab Pengawas:</strong></p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li>Memastikan prosedur penanganan barang dijalankan sesuai Standar Operasional Prosedur (SOP) keamanan CCE-DHS.</li>
                            <li>Mengawal langsung kesesuaian jumlah koli fisik saat bongkar-muat bersama pengawas dari DHS.</li>
                            <li>Memastikan setiap kondisi tidak biasa (seperti karung pecah, kemasan rusak, atau isi berceceran) langsung didokumentasikan dalam Berita Acara resmi di lokasi sebelum armada berangkat.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Perubahan Lokasi Pembongkaran Barang Consul di Makassar (Efektif 11 Juni 2026)</strong>
                        <p class="mt-1"><strong>Komitmen:</strong> Untuk meningkatkan akurasi kontrol selisih koli dan efisiensi rantai pasok, disepakati adanya penyesuaian lokasi pembongkaran khusus untuk barang konsolidasi (barang consul) milik DHS di wilayah Makassar.</p>
                        <p class="mt-1"><strong>Ketentuan Operasional:</strong></p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li>Terhitung mulai pemberangkatan armada tanggal 11 Juni 2026, seluruh proses pembongkaran barang consul dari Surabaya tidak lagi dilakukan di Gudang CCE Makassar, melainkan akan dialihkan dan dibongkar langsung di Gudang DHS Makassar.</li>
                            <li>Tim CCE Makassar tetap akan mengirimkan perwakilan personel pengawas untuk mendampingi, mengawasi, serta melakukan pencocokan data fisik bersama dengan tim penerima di Gudang DHS Makassar pada saat armada tiba.</li>
                        </ul>
                    </li>
                </ol>`
            );
            setDocumentBodyEnd('');
        }
    };

    // Load Laporan Investigasi Kehilangan
    const loadInvestigasiTemplate = () => {
        if (confirm("Reset dokumen ke template Laporan Investigasi Kehilangan? Perubahan yang belum dicetak akan hilang.")) {
            setActivePaymentScheme(null);
            setDocumentTitle('LAPORAN INVESTIGASI & KRONOLOGI KEHILANGAN BARANG');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([
                { resi: 'SPXID065039708555', order: 'TO202605293D9ZG', notes: '-' },
                { resi: 'SPXID068337159165', order: 'TO202605293EGRI', notes: '-' },
                { resi: 'SPXID064487229745', order: 'TO202605293EI4A', notes: '-' },
                { resi: 'SPXID066533886485', order: 'TO202605293D9ZG', notes: '-' },
                { resi: 'SPXID069867400215', order: 'TO202605293D9ZG', notes: '-' },
                { resi: 'SPXID066094989675', order: 'TO202605293ENSI', notes: '-' },
                { resi: 'SPXID061571645185', order: 'TO202605293EDKC', notes: '-' }
            ]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">Nomor Ref</div>
                    <div class="col-span-6">: 024/CCE-INV/VI/2026</div>
                    <div class="col-span-4 text-right font-semibold text-[10pt]">Tanggal Laporan: 09 Juni 2026</div>
                </div>`
            );
            setDocumentBody(
                `<h3 class="font-extrabold uppercase mb-2 text-gray-900 text-[10.5pt]">I. RINGKASAN EKSEKUTIF</h3>
                <p>Laporan ini disusun berdasarkan adanya laporan kehilangan barang (Data LT) yang diterima oleh PT Duta Hantaran Surabaya (DHS) pada tanggal 08 Juni 2026. Kehilangan ini merujuk pada proses pemuatan barang yang dilakukan pada tanggal 29 Mei 2026 dari CCE Surabaya dengan tujuan akhir Maros DC melalui Cabang Makassar.</p>
                <p class="mt-2">Laporan ini bertujuan untuk memetakan alur perjalanan barang, mengidentifikasi pihak-pihak yang terlibat, serta menganalisis beberapa kejanggalan administratif dan operasional yang ditemukan di lapangan guna menentukan titik terjadinya selisih barang.</p>
                
                <h3 class="font-extrabold uppercase mt-6 mb-2 text-gray-900 text-[10.5pt]">II. DETAIL PENGIRIMAN &amp; PIHAK TERKAIT</h3>
                <div>
                    <h4 class="font-bold underline text-gray-800">1. Armada Transportasi</h4>
                    <div class="ml-4 mt-2 grid grid-cols-2 gap-4">
                        <div>
                            <p class="font-semibold text-gray-700">Unit Pemuatan Awal (Fuso):</p>
                            <p>Nama Driver: Riswan</p>
                            <p>No. Polisi (Plat): DD 8250 LQ</p>
                        </div>
                        <div>
                            <p class="font-semibold text-gray-700">Unit Langsir / Pindah Tempat:</p>
                            <p>Nama Driver: Alvian</p>
                            <p>No. Polisi (Plat): B 9521 GO</p>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <h4 class="font-bold underline text-gray-800">2. Personel Pengawas (Proses Pemuatan - 29 Mei 2026)</h4>
                    <div class="ml-4 mt-2 grid grid-cols-2 gap-4">
                        <div>
                            <p class="font-semibold text-gray-700">Pengawas DHS (Surabaya):</p>
                            <p>• Pak Aan</p>
                            <p>• Pak Fauzan</p>
                        </div>
                        <div>
                            <p class="font-semibold text-gray-700">Pengawas CCE (Surabaya):</p>
                            <p>• Pak Indar</p>
                            <p>• Pak Ali</p>
                        </div>
                    </div>
                </div>
                
                <h3 class="font-extrabold uppercase mt-6 mb-2 text-gray-900 text-[10.5pt]">III. KRONOLOGI PERJALANAN BARANG</h3>
                <ul class="list-disc pl-5 space-y-2">
                    <li><strong>29 Mei 2026 (Proses Pemuatan di CCE Surabaya):</strong>
                        <ul class="list-circle pl-5 mt-1 space-y-1">
                            <li>Proses pemuatan barang dilakukan dengan pengawasan ketat secara langsung oleh 4 (empat) orang pengawas dari DHS dan CCE.</li>
                            <li>Dilakukan pengemasan khusus untuk Barang Mahal (Barhal) ke dalam 2 (dua) karung khusus yang masing-masing berisi 8 TO (Total 16 TO).</li>
                            <li><strong>Bukti Pengawasan:</strong> Pengawas DHS dan CCE bekerja sama mendokumentasikan proses pengisian Barhal ke dalam karung melalui rekaman video.</li>
                            <li>Barang dimuat ke unit pertama (Fuso DD 8250 LQ - Driver: Riswan) dan kemudian dilansir/dipindahkan ke unit kedua (B 9521 GO - Driver: Alvian).</li>
                        </ul>
                    </li>
                    <li class="mt-3"><strong>Perjalanan &amp; Pembongkaran di Cabang Makassar:</strong>
                        <ul class="list-circle pl-5 mt-1 space-y-1">
                            <li>Unit tiba di Cabang Makassar untuk proses pembongkaran.</li>
                            <li>Saat pembongkaran, karung berisi Barhal diverifikasi masih dalam keadaan tersegel rapi.</li>
                            <li><strong>Bukti Pembongkaran:</strong> Proses ini didokumentasikan melalui rekaman video pembongkaran.</li>
                            <li><strong>Catatan Hitung Koli:</strong> Pernyataan awal dari Cabang Makassar menyebutkan bahwa jumlah koli yang dihitung saat pembongkaran menunjukkan status lebih koli (kelebihan jumlah fisik koli dibanding manifes awal dari Surabaya).</li>
                        </ul>
                    </li>
                    <li class="mt-3"><strong>Penerimaan di Maros DC:</strong>
                        <ul class="list-circle pl-5 mt-1 space-y-1">
                            <li>Saat barang tiba dan dihitung kembali di Maros DC, dilaporkan terjadi pengurangan koli (kurang koli) sebanyak 7 resi.</li>
                        </ul>
                    </li>
                    <li class="mt-3"><strong>08 Juni 2026 (Laporan Kehilangan DHS):</strong>
                        <ul class="list-circle pl-5 mt-1 space-y-1">
                            <li>Pihak DHS menerima laporan resmi mengenai adanya kehilangan barang (Data LT) sebanyak 7 resi.</li>
                        </ul>
                    </li>
                </ul>`
            );
            setDocumentBodyEnd(
                `<h3 class="font-extrabold uppercase mt-6 mb-2 text-gray-900 text-[10.5pt]">V. ANALISIS TEMUAN &amp; PERTANYAAN KUNCI (DISCREPANCIES)</h3>
                <ol class="list-decimal pl-5 space-y-4">
                    <li><strong>Status Validitas "Barang Mahal" (Barhal)</strong>
                        <p class="mt-1"><strong>Temuan:</strong> Data resi/TO yang dilaporkan hilang di atas tidak sama dengan data TO Barhal yang disiapkan dan dimasukkan ke dalam 2 karung segel di CCE Surabaya.</p>
                        <p class="mt-1"><strong>Pertanyaan:</strong> Apakah 7 barang yang dilaporkan hilang tersebut memang dikategorikan sebagai Barang Mahal? Jika benar Barhal, mengapa nomor TO-nya tidak cocok dengan daftar Barhal yang dikoordinasikan saat pemuatan? Mengingat 2 karung Barhal tiba di Makassar dalam kondisi segel utuh, maka besar kemungkinan barang yang hilang ini berada di luar karung segel tersebut (karung reguler).</p>
                    </li>
                    <li class="mt-3"><strong>Karakteristik Fisik Barang &amp; Pengawasan Lapangan</strong>
                        <p class="mt-1"><strong>Temuan:</strong> Kehilangan berjumlah 7 koli/paket. Jika ini merupakan barang ukuran besar (bulky) atau karung biasa di luar segel Barhal, pemindahannya secara ilegal (tindakan kriminal atau kelalaian) di lokasi asal seharusnya sangat sulit terjadi.</p>
                        <p class="mt-1"><strong>Pertanyaan:</strong> Apakah barang tersebut merupakan barang bulky atau karung biasa? Selama proses pemuatan di CCE Surabaya, terdapat 4 (empat) orang pengawas fisik yang siaga (Pak Aan, Pak Fauzan, Pak Indar, dan Pak Ali). Jika terjadi kejanggalan atau tindakan mencurigakan pada fase pemuatan, bagaimana hal tersebut bisa lolos dari pengawasan langsung empat orang personel tersebut?</p>
                    </li>
                    <li class="mt-3"><strong>Selisih Hitung Koli &amp; Potensi Kerusakan Kemasan (Surabaya - Makassar - Maros DC)</strong>
                        <p class="mt-1"><strong>Temuan:</strong> Terdapat kontradiksi data hitung koli yang sangat signifikan di titik transit:</p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li>Surabaya: Data muat awal.</li>
                            <li>Cabang Makassar: Melaporkan hasil hitung fisik "Lebih Koli". Terdapat indikasi kuat bahwa status "lebih" ini dipicu oleh adanya karung pembungkus luar yang robek, lepas, atau pecah selama perjalanan, sehingga paket-paket kecil di dalamnya tercecer keluar dan dihitung satu per satu sebagai koli terpisah.</li>
                            <li>Maros DC: Melaporkan hasil hitung fisik "Kurang Koli" (selisih kurang 7 resi) setelah dilakukan rekonsiliasi data manifes asli.</li>
                        </ul>
                        <p class="mt-1"><strong>Pertanyaan:</strong> Bagaimana proses penanganan dan pencocokan paket yang tercecer tersebut dilakukan di Cabang Makassar? Jika paket yang tercecer menyebabkan hitungan fisik terkesan "lebih" di Makassar, mengapa setelah diteruskan ke Maros DC jumlahnya justru berkurang (minus 7 koli)? Apakah ada item tercecer yang tertinggal, salah rute, atau salah penyerahan saat pemuatan ulang di Cabang Makassar menuju Maros DC?</p>
                    </li>
                </ol>`
            );
        }
    };

    // Load Surat Keterangan
    const loadSuratKeteranganTemplate = () => {
        if (confirm("Reset dokumen ke template Surat Keterangan? Perubahan yang belum dicetak akan hilang.")) {
            setActivePaymentScheme(null);
            setDocumentTitle('SURAT KETERANGAN JALAN ARMADA');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">No. Surat</div>
                    <div class="col-span-6">: 015/CCE-SK/VI/2026</div>
                    <div class="col-span-4 text-right font-semibold text-[10pt]">Surabaya, 09 Juni 2026</div>
                </div>`
            );
            setDocumentBody(
                `<p class="mt-4">Dengan ini Direksi CV. Cahaya Cargo Express menerangkan bahwa armada yang tercantum di bawah ini berada dalam tugas operasional resmi pengangkutan logistik lintas cabang:</p>
                <div class="mt-4 ml-4 space-y-2 text-gray-800">
                    <p><strong>Nama Driver:</strong> Riswan</p>
                    <p><strong>Nomor Polisi:</strong> DD 8250 LQ</p>
                    <p><strong>Jenis Unit:</strong> Mitsubishi Fuso Long</p>
                    <p><strong>Rute Perjalanan:</strong> Surabaya - Makassar (Via Tanjung Perak)</p>
                </div>
                <p class="mt-4">Surat keterangan ini diberikan kepada yang bersangkutan untuk dipergunakan sebagai bukti jalan yang sah dan sebagai dokumen pendukung pemeriksaan pos jembatan timbang maupun pelabuhan.</p>
                <p class="mt-2">Demikian surat keterangan ini dibuat dengan sebenarnya untuk digunakan sebagaimana mestinya.</p>`
            );
            setDocumentBodyEnd('');
        }
    };

    // Load Kesiapan Operasional & Keamanan Template
    const loadKesiapanTemplate = () => {
        if (confirm("Reset dokumen ke template Laporan Kesiapan Operasional? Perubahan yang belum dicetak akan hilang.")) {
            setActivePaymentScheme(null);
            setDocumentTitle('SURAT PEMBERITAHUAN KESIAPAN OPERASIONAL DAN IMPLEMENTASI KEAMANAN');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Director of Operations / Branch Manager');
            setLostItems([]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">No. Surat</div>
                    <div class="col-span-6">: CCE/DIR-OPS/SPK-READY/VI/2026</div>
                    <div class="col-span-4 text-right font-semibold text-[10pt]">Surabaya, 19 Juni 2026</div>
                    
                    <div class="col-span-2 font-semibold">Sifat</div>
                    <div class="col-span-10">: Penting / Segera</div>
                    
                    <div class="col-span-2 font-semibold">Lampiran</div>
                    <div class="col-span-10">: -</div>
                    
                    <div class="col-span-2 font-semibold">Hal</div>
                    <div class="col-span-10 font-bold">: Pemberitahuan Kesiapan Personel Team CCE dan Kelengkapan Sistem Keamanan Gudang Muat (Surabaya) &amp; Gudang Bongkar (Makassar)</div>
                </div>
                <div class="mt-5 text-[10.5pt]">
                    <p>Kepada Yth.</p>
                    <p class="font-bold">Pimpinan Manajemen PT DUTA HANTARAN SURABAYA (DHS)</p>
                    <p>Di Tempat</p>
                </div>`
            );
            setDocumentBody(
                `<p class="mt-4">Dengan hormat,</p>
                <p class="mt-2">Merujuk pada Surat Pernyataan Komitmen Bersama (No. Surat: CCE/DIR-OPS/SPK/VI/2026) yang telah kami sampaikan pada tanggal 09 Juni 2026 terkait rencana evaluasi operasional dan peningkatan sistem keamanan area kerja, kami selaku manajemen Cahaya Cargo (CCE) dengan ini menyampaikan kabar baik mengenai kesiapan penuh (operational readiness) seluruh tim kami di lapangan beserta kelengkapan fasilitas keamanan yang telah selesai diimplementasikan.</p>
                <p class="mt-2">Berikut adalah laporan rincian kesiapan operasional serta kelengkapan keamanan di Gudang Muat (Cabang Surabaya) dan Gudang Bongkar (Cabang Makassar) per tanggal 19 Juni 2026:</p>
                
                <ol class="list-decimal pl-5 space-y-4 mt-4">
                    <li>
                        <strong>Kesiapan Sistem Pemantauan Visual (CCTV Baru Aktif 24/7)</strong>
                        <p class="mt-1">Kami mengonfirmasi bahwa penambahan dan optimalisasi perangkat CCTV berspesifikasi tinggi (High-Definition) telah selesai dilaksanakan 100% pada kedua titik cabang:</p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li><strong>Gudang Muat (Surabaya):</strong> CCTV baru telah terpasang dan aktif memantau area blind spots (khususnya area loading, penataan barang di staging area, serta jalur keluar-masuk armada). Sistem penyimpanan data (backup storage) telah ditingkatkan dengan kapasitas retensi rekaman yang lebih panjang dan aman.</li>
                            <li><strong>Gudang Bongkar (Makassar):</strong> Penambahan unit kamera pengawas visual juga telah selesai dipasang untuk memantau ketat seluruh aktivitas pembongkaran, pemindahan barang, serta penyerahan dokumen operasional di area gudang.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Kesiapan Sistem Pemindaian Digital (Scanning System)</strong>
                        <p class="mt-1">Perangkat pemindai (barcode scanner) beserta integrasi sistem internal CCE telah siap digunakan sepenuhnya.</p>
                        <p class="mt-1">Mulai saat ini, setiap koli/resi milik DHS yang masuk ke gudang muat (Surabaya) maupun yang keluar dari gudang bongkar (Makassar) wajib melalui proses scanning digital secara real-time guna meminimalkan kesalahan hitung (human error) dan mendeteksi selisih koli sejak dini.</p>
                    </li>
                    <li>
                        <strong>Kesiapan Personel Pengawas Khusus (Dedicated Operational Supervisor)</strong>
                        <p class="mt-1">Kami telah menunjuk dan menugaskan staf khusus yang berdedikasi penuh untuk mengawal jalannya operasional barang DHS. Berikut adalah nama personel pengawas CCE yang bertugas:</p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li><strong>Pengawas Khusus Gudang Surabaya (Muat):</strong> Pak Indar / Pak Ali</li>
                            <li><strong>Pengawas Khusus Gudang Makassar (Bongkar/Transit):</strong> Staf Operational Supervisor Makassar</li>
                        </ul>
                        <p class="mt-1">Tugas utama tim ini adalah memastikan kepatuhan SOP penanganan barang, mengawal penghitungan fisik secara ketat bersama pengawas dari DHS, serta langsung menerbitkan Berita Acara di lokasi apabila ditemukan kondisi kemasan yang tidak standar (seperti karung robek, pecah, atau berceceran).</p>
                    </li>
                    <li>
                        <strong>Realisasi Pembongkaran Barang Consul di Gudang DHS Makassar</strong>
                        <p class="mt-1">Terkait kesepakatan pemindahan lokasi pembongkaran barang konsolidasi (barang consul) asal Surabaya yang efektif berlaku sejak keberangkatan armada tanggal 11 Juni 2026, kami laporkan bahwa:</p>
                        <ul class="list-disc pl-5 mt-1 space-y-1">
                            <li>Seluruh proses pembongkaran muatan consul telah dialihkan dan dijalankan langsung di Gudang DHS Makassar (bukan di gudang CCE).</li>
                            <li>Tim pengawas dari CCE Makassar secara konsisten dikirim ke lokasi Gudang DHS Makassar untuk melakukan pendampingan pengawasan serta pencocokan data serah terima fisik bersama tim DHS di lokasi tujuan.</li>
                        </ul>
                    </li>
                </ol>
                
                <h4 class="font-extrabold uppercase mt-6 mb-2 text-gray-900 text-[10.5pt]">Penutup dan Komitmen Kemitraan</h4>
                <p class="text-justify">Dengan seluruh kelengkapan infrastruktur keamanan serta kesiapan personel yang telah terpasang dan berjalan ini, kami meyakini kualitas layanan operasional, akurasi perhitungan barang, serta keamanan pengiriman barang milik PT Duta Hantaran Surabaya (DHS) akan terjaga dengan jauh lebih baik dan transparan.</p>
                <p class="mt-2 text-justify">Kami mengucapkan terima kasih yang sebesar-besarnya atas kepercayaan dan kerja sama yang terus terjalin erat dengan PT Duta Hantaran Surabaya (DHS). Kami berkomitmen penuh untuk terus menjaga standar keamanan ini demi kesuksesan operasional bersama.</p>
                <p class="mt-2">Demikian surat pemberitahuan ini kami sampaikan agar dapat menjadi acuan bersama.</p>`
            );
            setDocumentBodyEnd('');
        }
    };

    // Reset to Surat Penawaran Harga J&T Cargo
    const loadPenawaranTemplate = () => {
        if (confirm("Reset dokumen ke template Penawaran Harga & Ketentuan Kerja Sama J&T Cargo? Perubahan yang belum dicetak akan hilang.")) {
            setActivePaymentScheme(null);
            setDocumentTitle('SURAT PENAWARAN HARGA & KETENTUAN KERJA SAMA PENGANGKUTAN CARGO');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">Nomor</div>
                    <div class="col-span-10">: 028/CCE-QUO/VII/2026</div>
                    
                    <div class="col-span-2 font-semibold">Lampiran</div>
                    <div class="col-span-10">: -</div>
                    
                    <div class="col-span-2 font-semibold">Perihal</div>
                    <div class="col-span-10 font-bold">: SURAT PENAWARAN HARGA & KETENTUAN KERJA SAMA PENGANGKUTAN CARGO<br/>(RUTE: SURABAYA - PALU - MANADO & SURABAYA - MAKASSAR - MANADO)</div>
                </div>
                <div class="mt-5 text-[10.5pt]">
                    <p>Kepada Yth,</p>
                    <p class="font-bold">Management / Procurement</p>
                    <p class="font-bold text-slate-900">J&T CARGO (PT Global Jet Cargo)</p>
                    <p class="text-slate-700">Kedudukan sebagai: PENGIRIM (SHIPPER)</p>
                    <p>Di Tempat</p>
                </div>`
            );
            setDocumentBody(
                `<p class="mt-4">Dengan hormat,</p>
                <p class="mt-2">Sehubungan dengan rencana kerja sama pengangkutan dan distribusi kargo muatan milik J&T Cargo (selaku PENGIRIM) rute Surabaya menuju Manado, kami dari <strong>PT CAHAYA CARGO EXPRESS</strong> (selaku PENYEDIA JASA PENGANGKUTAN / TRANSPORTER) mengajukan Penawaran Harga, Layanan Operasional, serta Syarat & Ketentuan Legal Kerjasama sebagai berikut:</p>
                
                <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">1. TARIF PENGANGKUTAN, SLA, DAN FREKUENSI KAPAL</h3>
                <table class="w-full text-left border-collapse mt-2 text-[10pt] border border-slate-300">
                    <thead>
                        <tr class="bg-slate-100 border-b border-slate-350 font-semibold text-slate-700">
                            <th class="p-2.5 border-r border-slate-300 w-[8%] text-center">No</th>
                            <th class="p-2.5 border-r border-slate-300 w-[36%]">Rute Pengiriman</th>
                            <th class="p-2.5 border-r border-slate-300 w-[20%] text-center">Tarif per Kg</th>
                            <th class="p-2.5 border-r border-slate-300 w-[18%] text-center">SLA (Hari)</th>
                            <th class="p-2.5 w-[18%] text-center">Jadwal Kapal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-300">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono">1.</td>
                            <td class="p-2.5 border-r border-slate-300 font-semibold text-slate-900">Surabaya - Palu - Manado</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-bold text-slate-900">Rp 5.400 / kg</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-semibold">8 - 9 Hari</td>
                            <td class="p-2.5 text-center font-semibold">1 Kali Seminggu</td>
                        </tr>
                        <tr class="border-b border-slate-300">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono">2.</td>
                            <td class="p-2.5 border-r border-slate-300 font-semibold text-slate-900">Surabaya - Makassar - Manado</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-bold text-slate-900">Rp 5.800 / kg</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-semibold">9 - 10 Hari</td>
                            <td class="p-2.5 text-center font-semibold">3 Kali Seminggu</td>
                        </tr>
                        <tr class="border-b border-slate-300">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono">3.</td>
                            <td class="p-2.5 border-r border-slate-300 font-semibold text-slate-900">Surabaya - Palu</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-bold text-slate-900">Rp 3.500 / kg</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-semibold">5 - 6 Hari</td>
                            <td class="p-2.5 text-center font-semibold">2 Kali Seminggu</td>
                        </tr>
                        <tr class="border-b border-slate-300">
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono">4.</td>
                            <td class="p-2.5 border-r border-slate-300 font-semibold text-slate-900">Makassar - Manado</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-mono font-bold text-slate-900">Rp 4.000 / kg</td>
                            <td class="p-2.5 border-r border-slate-300 text-center font-semibold">4 - 5 Hari</td>
                            <td class="p-2.5 text-center font-semibold">3 Kali Seminggu</td>
                        </tr>
                    </tbody>
                </table>
                <p class="mt-1.5 text-[9pt] italic text-slate-600">* Dasar Perhitungan Berat: Kuantitas dan berat chargeable mengacu penuh pada data penimbangan resmi dari SISTEM J&T CARGO (Pengirim).</p>

                <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">2. OPERASIONAL GUDANG & TENAGA KERJA (TKBM)</h3>
                <div class="space-y-2 text-[9.5pt]">
                    <p><strong>a. Tenaga Kerja Bongkar Muat (TKBM):</strong><br/>
                    PT Cahaya Cargo Express menyediakan tim TKBM sebanyak 10 (sepuluh) orang per shift yang standby 1 x 24 Jam di gudang J&T Cargo untuk penanganan muat dan bongkar barang.</p>
                    <p><strong>b. Layanan Pemuatan (Loading):</strong><br/>
                    Proses pemuatan barang dilakukan secara standby 24 Jam di gudang J&T Cargo sesuai jadwal manifes pengiriman.</p>
                </div>

                <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">3. JAMINAN DEPOSIT & SYARAT PEMBAYARAN (TOP)</h3>
                <div class="space-y-2 text-[9.5pt]">
                    <p><strong>a. Skema Jaminan Deposit / Bank Guarantee:</strong><br/>
                    J&T Cargo (Pengirim) memberikan Deposit Uang / Bank Guarantee sebagai jaminan jangkauan operasional sebesar total Rp 150.000.000,- (Seratus Lima Puluh Juta Rupiah), dengan skema pembayaran bertahap sebagai berikut:</p>
                    <ul class="list-disc pl-5 font-mono text-[9pt] space-y-0.5">
                        <li>Tahap I (Bulan ke-1) : Rp 50.000.000,-</li>
                        <li>Tahap II (Bulan ke-2) : Rp 50.000.000,-</li>
                        <li>Tahap III (Bulan ke-3) : Rp 50.000.000,-</li>
                    </ul>
                    <p><strong>b. Syarat Pembayaran (Payment Terms):</strong><br/>
                    Pembayaran tagihan jasa pengangkutan dilakukan dalam kurun waktu 2 (dua) minggu / 14 (empat belas) hari kalender terhitung sejak barang diterima di tujuan dengan aman (dibuktikan dengan Proof of Delivery / POD yang sah).</p>
                </div>

                <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">4. ASURANSI BARANG, KLAIM, DAN FORCE MAJEURE</h3>
                <div class="space-y-2 text-[9.5pt]">
                    <p><strong>a. Asuransi Barang Di Atas Truk:</strong><br/>
                    Seluruh kargo muatan dilindungi asuransi di atas armada truk dengan nilai pertanggungan maksimal hingga Rp 600.000.000,- (Enam Ratus Juta Rupiah) per Truk.</p>
                    <p><strong>b. Pencairan Klaim:</strong><br/>
                    Setiap terjadi klaim asuransi barang yang disetujui (approved) oleh pihak penanggung asuransi, dana klaim akan LANGSUNG DICAIRKAN / DITRANSFER KE REKENING J&T CARGO.</p>
                    <p><strong>c. Force Majeure (Keadaan Kahar):</strong><br/>
                    PT Cahaya Cargo Express dibebaskan dari tanggung jawab ganti rugi atau keterlambatan yang disebabkan oleh Keadaan Kahar (Force Majeure), termasuk namun tidak terbatas pada bencana alam, kecelakaan laut/cuaca ekstrem pelayaran, huru-hara, penutupan pelabuhan oleh otoritas pemerintah, dan kejadian di luar kendali wajar manusia.</p>
                </div>

                <h3 class="font-extrabold uppercase mt-5 mb-2 text-slate-900 text-[10pt]">5. MASA BERLAKU PENAWARAN</h3>
                <p class="text-[9.5pt]">Penawaran harga dan ketentuan operasional ini bersifat mengikat dan tidak memiliki batas masa berlaku penawaran (tanpa masa kadaluarsa), serta menjadi acuan utama pelaksanaan Surat Perjanjian Kerja Sama (SPK) antara kedua belah pihak.</p>

                <p class="mt-4 text-[9.5pt]">Demikian surat penawaran harga ini kami sampaikan. Atas perhatian dan kerja sama yang baik, kami ucapkan terima kasih.</p>
                
                <div class="mt-8 text-[9.5pt]">
                    <p class="mb-4">Surabaya, 29 Juli 2026</p>
                    <div class="flex justify-between items-start">
                        <div class="text-center w-[45%]">
                            <p class="font-bold">Diajukan Oleh,</p>
                            <p class="font-bold text-slate-900">PT CAHAYA CARGO EXPRESS</p>
                            <p class="text-slate-600 text-[8.5pt]">(Transporter)</p>
                            <div class="h-20"></div>
                            <p class="font-bold underline">( ________________________ )</p>
                            <p class="text-[8.5pt]">Nama:</p>
                            <p class="text-[8.5pt]">Jabatan:</p>
                        </div>
                        <div class="text-center w-[45%]">
                            <p class="font-bold">Disetujui &amp; Diterima Oleh,</p>
                            <p class="font-bold text-slate-900">J&T CARGO (PT Global Jet Cargo)</p>
                            <p class="text-slate-600 text-[8.5pt]">(Pengirim / Shipper)</p>
                            <div class="h-20"></div>
                            <p class="font-bold underline">( ________________________ )</p>
                            <p class="text-[8.5pt]">Nama:</p>
                            <p class="text-[8.5pt]">Jabatan:</p>
                        </div>
                    </div>
                </div>`
            );
            setDocumentBodyEnd('');
        }
    };

    // Load Blank
    const loadBlankTemplate = () => {
        if (confirm("Kosongkan semua konten dokumen?")) {
            setActivePaymentScheme(null);
            setDocumentTitle('JUDUL DOKUMEN RESMI');
            setLostItems([]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">No. Surat</div>
                    <div class="col-span-6">: .../.../.../2026</div>
                    <div class="col-span-4 text-right font-semibold text-[10pt]">Surabaya, 09 Juni 2026</div>
                </div>`
            );
            setDocumentBody('<p class="mt-4">Tulis isi dokumen legal di sini...</p>');
            setDocumentBodyEnd('');
        }
    };

    return (
        <RouteGuard module="dokumen_legal">
            <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
            {/* Embed print styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .a4-page {
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important; /* Reset padding to use native browser page margins */
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                    }
                    [contenteditable="true"] {
                        outline: none !important;
                        border: none !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: ${paddingSize}; /* Dynamically sets browser print margins matching selected padding */
                    }
                }
                `
            }} />

            {/* Left Sidebar Control Panel (no-print) */}
            <div className="no-print w-full md:w-96 bg-slate-900 text-white p-6 md:min-h-screen flex flex-col gap-5 shadow-xl border-r border-slate-800 z-20">
                
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <FileSignature className="text-emerald-400" size={24} />
                        <div>
                            <span className="font-bold text-lg block leading-tight">Cetak Dokumen Legal</span>
                            <span className="text-[10px] text-slate-400">Legal Draft &amp; Agreement Generator</span>
                        </div>
                    </div>
                    <Link href="/">
                        <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Kembali">
                            <ArrowLeft size={18} />
                        </button>
                    </Link>
                </div>

                {/* Quick Print Button */}
                <div>
                    <button 
                        onClick={() => window.print()}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Printer size={20} />
                        Cetak Dokumen (A4)
                    </button>
                </div>

                {/* 🐴 KESEPAKATAN DEAL HARGA MUATAN KHUSUS */}
                <div className="bg-gradient-to-b from-amber-950/40 to-slate-800/80 p-3.5 rounded-xl border border-amber-500/40 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag size={15} /> Deal Harga Muatan Khusus
                        </label>
                        <span className="text-[9px] bg-amber-950 text-amber-300 font-semibold px-1.5 py-0.5 rounded border border-amber-800">
                            Rp 42.950.000
                        </span>
                    </div>
                    <button 
                        onClick={loadDealKudaTemplate}
                        className="w-full text-left p-2.5 rounded-lg border bg-amber-900/40 hover:bg-amber-800/60 border-amber-500/50 hover:border-amber-400 text-white transition-all flex items-start gap-2.5 shadow-sm"
                        title="Muat Dokumen Kesepakatan Kuda 16 Ekor"
                    >
                        <span className="text-xl">🐴</span>
                        <div>
                            <div className="text-xs font-bold text-amber-300">
                                Kesepakatan Deal Kuda 16 Ekor
                            </div>
                            <div className="text-[9.5px] text-amber-200/80 leading-tight mt-0.5">
                                Dimas Andika Perkasa (Dago Bandung) ke Malino Gowa (Sulsel). Include Tiket Kapal, Penumpang &amp; Bagasi. Exclude Karantina.
                            </div>
                        </div>
                    </button>
                </div>

                {/* ⭐ DOKUMEN TERMS & CONDITIONS (T&C) DENGAN 3 PILIHAN SKEMA PEMBAYARAN */}
                <div className="bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-3.5 rounded-xl border border-emerald-500/30 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck size={15} /> Dokumen Terms &amp; Conditions (T&amp;C)
                        </label>
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 font-semibold px-1.5 py-0.5 rounded border border-emerald-800">
                            Legal Format
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                        Pilih template Syarat &amp; Ketentuan Pengiriman Kargo dengan skema pembayaran:
                    </p>

                    <div className="flex flex-col gap-2">
                        {/* Option 1: DP 70% Berangkat + 30% Sandar */}
                        <button 
                            onClick={() => loadTermsCondTemplate('dp_70_30')}
                            className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                                activePaymentScheme === 'dp_70_30'
                                    ? 'bg-blue-900/60 border-blue-400 text-white shadow-md' 
                                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200 hover:border-slate-500'
                            }`}
                        >
                            <Ship size={18} className="text-blue-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-xs font-bold text-blue-300 flex items-center gap-1">
                                    DP 70% Berangkat + 30% Sandar
                                    {activePaymentScheme === 'dp_70_30' && <CheckCircle2 size={12} className="text-blue-400" />}
                                </div>
                                <div className="text-[9.5px] text-slate-400 leading-tight mt-0.5">
                                    DP 70% saat kapal sailing, pelunasan 30% saat sandar sebelum bongkar.
                                </div>
                            </div>
                        </button>

                        {/* Option 2: Lunas Cash */}
                        <button 
                            onClick={() => loadTermsCondTemplate('lunas_cash')}
                            className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                                activePaymentScheme === 'lunas_cash'
                                    ? 'bg-emerald-900/60 border-emerald-400 text-white shadow-md' 
                                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200 hover:border-slate-500'
                            }`}
                        >
                            <Banknote size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                    Lunas Cash (Tunai di Awal)
                                    {activePaymentScheme === 'lunas_cash' && <CheckCircle2 size={12} className="text-emerald-400" />}
                                </div>
                                <div className="text-[9.5px] text-slate-400 leading-tight mt-0.5">
                                    Pembayaran 100% tunai di loket kasir saat serah terima barang di gudang.
                                </div>
                            </div>
                        </button>

                        {/* Option 3: TF Lunas di Awal */}
                        <button 
                            onClick={() => loadTermsCondTemplate('tf_lunas_awal')}
                            className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                                activePaymentScheme === 'tf_lunas_awal'
                                    ? 'bg-indigo-900/60 border-indigo-400 text-white shadow-md' 
                                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200 hover:border-slate-500'
                            }`}
                        >
                            <CreditCard size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                                    TF Lunas di Awal (Pre-Payment)
                                    {activePaymentScheme === 'tf_lunas_awal' && <CheckCircle2 size={12} className="text-indigo-400" />}
                                </div>
                                <div className="text-[9.5px] text-slate-400 leading-tight mt-0.5">
                                    Transfer 100% ke rekening BCA/BRI/Mandiri sebelum manifest kapal berangkat.
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Quick Payment Switcher for Active T&C */}
                    {activePaymentScheme && (
                        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 flex items-center gap-1"><Sparkles size={11} className="text-yellow-400" /> Ganti Skema Cepat:</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => switchTermsPaymentScheme('dp_70_30')}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePaymentScheme === 'dp_70_30' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    title="Ganti ke DP 70% + 30%"
                                >
                                    70/30
                                </button>
                                <button 
                                    onClick={() => switchTermsPaymentScheme('lunas_cash')}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePaymentScheme === 'lunas_cash' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    title="Ganti ke Lunas Cash"
                                >
                                    Cash
                                </button>
                                <button 
                                    onClick={() => switchTermsPaymentScheme('tf_lunas_awal')}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePaymentScheme === 'tf_lunas_awal' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    title="Ganti ke Transfer Prepayment"
                                >
                                    TF Awal
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Templates Selector (Other Legal Documents) */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                        <FileText size={14} /> Dokumen &amp; Surat Lainnya
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={loadPenawaranTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center text-yellow-300 font-bold col-span-2"
                            title="Penawaran Harga J&T"
                        >
                            Penawaran Harga J&T
                        </button>
                        <button 
                            onClick={loadKomitmenTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center"
                            title="Komitmen Bersama"
                        >
                            Komitmen SPK
                        </button>
                        <button 
                            onClick={loadKesiapanTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center text-emerald-300 font-bold"
                            title="Kesiapan Operasional & Keamanan"
                        >
                            Kesiapan Ops
                        </button>
                        <button 
                            onClick={loadInvestigasiTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center"
                            title="Laporan Kehilangan"
                        >
                            Investigasi LT
                        </button>
                        <button 
                            onClick={loadSuratKeteranganTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center"
                            title="Surat Keterangan"
                        >
                            Surat Ket
                        </button>
                        <button 
                            onClick={loadBlankTemplate}
                            className="bg-slate-800 hover:bg-red-900/40 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-red-900/60 transition-all text-center text-red-300 col-span-2"
                            title="Mulai Dari Kosong"
                        >
                            Kosong
                        </button>
                    </div>
                </div>

                {/* Document Options */}
                <div className="space-y-4 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Opsi Tampilan</label>
                    
                    {/* Toggle Kop & TTD */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Kop Surat Resmi</span>
                        <button 
                            onClick={() => setShowKop(!showKop)}
                            className={`p-1.5 rounded-lg transition-colors ${showKop ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                            title={showKop ? 'Sembunyikan Kop' : 'Tampilkan Kop'}
                        >
                            {showKop ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Tanda Tangan & Stempel</span>
                        <button 
                            onClick={() => setShowTtd(!showTtd)}
                            className={`p-1.5 rounded-lg transition-colors ${showTtd ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                            title={showTtd ? 'Sembunyikan TTD' : 'Tampilkan TTD'}
                        >
                            {showTtd ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>

                    {/* Font Family Selector */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-slate-300 flex items-center gap-1"><Type size={16} /> Jenis Huruf</span>
                        <select 
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none"
                        >
                            <option value="sans">Arial (Clean Sans-Serif)</option>
                            <option value="serif">Georgia (Formal Serif)</option>
                            <option value="mono">Courier (Monospace/Mesin Ketik)</option>
                        </select>
                    </div>

                    {/* Font Size & Spacing */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-slate-400">Ukuran Huruf</span>
                            <select 
                                value={fontSize}
                                onChange={(e) => setFontSize(e.target.value)}
                                className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none"
                            >
                                <option value="10pt">Kecil (10pt)</option>
                                <option value="11pt">Normal (11pt)</option>
                                <option value="12pt">Besar (12pt)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-slate-400">Jarak Baris</span>
                            <select 
                                value={lineHeight}
                                onChange={(e) => setLineHeight(e.target.value)}
                                className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none"
                            >
                                <option value="1.2">Rapat (1.2)</option>
                                <option value="1.5">Normal (1.5)</option>
                                <option value="1.8">Longgar (1.8)</option>
                            </select>
                        </div>
                    </div>

                    {/* Margin Selector */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-slate-300 flex items-center gap-1"><Layout size={16} /> Margin Halaman</span>
                        <select 
                            value={paddingSize}
                            onChange={(e) => setPaddingSize(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none"
                        >
                            <option value="15mm">Ramping (15mm)</option>
                            <option value="20mm">Standar (20mm)</option>
                            <option value="25mm">Lebar (25mm)</option>
                        </select>
                    </div>
                </div>

                {/* Signatory Control */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pengaturan Penandatangan</label>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-400">Nama Penandatangan</span>
                        <input 
                            type="text" 
                            value={signatoryName} 
                            onChange={(e) => setSignatoryName(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-400">Jabatan / Judul</span>
                        <input 
                            type="text" 
                            value={signatoryRole} 
                            onChange={(e) => setSignatoryRole(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none"
                        />
                    </div>
                </div>

                {/* Table Controller */}
                {lostItems.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-slate-800 mt-auto">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1"><FileSpreadsheet size={14} /> Tabel Data Hilang</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={addRow}
                                className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-3 rounded-lg border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <Plus size={14} /> Tambah Baris
                            </button>
                            <button 
                                onClick={removeRow}
                                className="bg-slate-800 hover:bg-red-900/30 text-xs font-semibold py-2 px-3 rounded-lg border border-slate-700 hover:border-red-900/50 flex items-center justify-center gap-1.5 transition-colors text-red-300"
                            >
                                <Trash2 size={14} /> Hapus Baris
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Live Preview Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
                
                {/* A4 Paper page container */}
                <div 
                    className="a4-page bg-white text-black min-h-[297mm] w-[210mm] transition-all relative"
                    style={{
                        padding: paddingSize,
                        fontSize: fontSize,
                        lineHeight: lineHeight,
                        fontFamily: fontFamilies[fontFamily],
                    }}
                >
                    {/* 1. KOP SURAT (Letterhead) */}
                    {showKop && (
                        <div className="w-full flex justify-between items-center border-b-[3px] border-double border-black pb-3 mb-6">
                            <div className="flex items-center gap-4">
                                <img 
                                    src="/logo.png" 
                                    alt="Logo" 
                                    className="w-[20mm] h-[20mm] object-contain"
                                />
                                <div>
                                    {/* Company name in bold black font */}
                                    <h2 className="text-xl md:text-2xl font-extrabold text-black tracking-wider font-serif">
                                        CV. CAHAYA CARGO EXPRESS
                                    </h2>
                                    <p className="text-[7.5pt] font-semibold tracking-wider text-slate-700 uppercase -mt-0.5">
                                        Jasa Pengiriman Barang - Domestik &amp; Internasional
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 mt-1.5 text-[6.5pt] text-gray-700 leading-tight">
                                        <div>
                                            <strong className="text-gray-950">SURABAYA (Pusat):</strong>
                                            <p>{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                                            <p>Telp: {COMPANY_INFO.phone}</p>
                                        </div>
                                        <div>
                                            <strong className="text-gray-950">MAKASSAR:</strong>
                                            <p>{COMPANY_INFO.branchAddress}, {COMPANY_INFO.branchCity}</p>
                                            <p>Telp: {COMPANY_INFO.branchPhone}</p>
                                        </div>
                                        <div>
                                            <strong className="text-gray-950">BANJARMASIN:</strong>
                                            <p>{COMPANY_INFO.branch2Address}, {COMPANY_INFO.branch2City}</p>
                                            <p>Telp: {COMPANY_INFO.branch2Phone}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. DOKUMEN HEADER & METADATA */}
                    <div className="text-center mb-6">
                        <h1 
                            className="text-base font-extrabold tracking-wide uppercase border-b border-black pb-1 inline-block"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setDocumentTitle(e.currentTarget.textContent || '')}
                            style={{ outline: 'none' }}
                        >
                            {documentTitle}
                        </h1>
                    </div>

                    <div className="mb-6">
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setDocumentMetadata(e.currentTarget.innerHTML || '')}
                            style={{ outline: 'none' }}
                            dangerouslySetInnerHTML={{ __html: documentMetadata }}
                            className="border border-transparent hover:border-dashed hover:border-gray-300 p-1 rounded transition-colors text-justify"
                        />
                    </div>

                    {/* 3. DOKUMEN BODY CONTENT */}
                    <div className="space-y-6 text-justify text-xs md:text-sm">
                        
                        {/* Main Body block */}
                        <div>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setDocumentBody(e.currentTarget.innerHTML || '')}
                                style={{ outline: 'none', cursor: 'text' }}
                                dangerouslySetInnerHTML={{ __html: documentBody }}
                                className="border border-transparent hover:border-dashed hover:border-gray-300 p-1 rounded transition-colors"
                            />
                        </div>

                        {/* Section IV: Lost Items Table (only renders if items are present) */}
                        {lostItems.length > 0 && (
                            <div>
                                <table className="w-full border-collapse border border-black text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-black">
                                            <th className="border border-black p-2 text-center font-bold w-[8%]">No</th>
                                            <th className="border border-black p-2 font-bold w-[46%]">Nomor Resi (SPXID)</th>
                                            <th className="border border-black p-2 font-bold w-[30%]">Nomor Order (TO ID)</th>
                                            <th className="border border-black p-2 font-bold w-[16%]">Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lostItems.map((item, idx) => (
                                             <tr key={idx} className="border-b border-black">
                                                <td className="border border-black p-2 text-center">{idx + 1}.</td>
                                                <td 
                                                    className="border border-black p-2 font-mono"
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => handleCellChange(idx, 'resi', e.currentTarget.textContent || '')}
                                                    style={{ outline: 'none' }}
                                                >
                                                    {item.resi}
                                                </td>
                                                <td 
                                                    className="border border-black p-2 font-mono"
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => handleCellChange(idx, 'order', e.currentTarget.textContent || '')}
                                                    style={{ outline: 'none' }}
                                                >
                                                    {item.order}
                                                </td>
                                                <td 
                                                    className="border border-black p-2"
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => handleCellChange(idx, 'notes', e.currentTarget.textContent || '')}
                                                    style={{ outline: 'none' }}
                                                >
                                                    {item.notes}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Section V: Analysis or Extra Body Block (only renders if present) */}
                        {documentBodyEnd && (
                            <div>
                                <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => setDocumentBodyEnd(e.currentTarget.innerHTML || '')}
                                    style={{ outline: 'none', cursor: 'text' }}
                                    dangerouslySetInnerHTML={{ __html: documentBodyEnd }}
                                    className="border border-transparent hover:border-dashed hover:border-gray-300 p-1 rounded transition-colors"
                                />
                            </div>
                        )}

                    </div>

                    {/* 4. PENUTUP & AREA TANDA TANGAN */}
                    <div className="mt-12 flex justify-between items-start avoid-break-inside">
                        <div className="w-[40%] text-xs">
                            <p className="font-semibold text-gray-500 mb-1">Catatan Dokumen:</p>
                            <p className="text-gray-400 italic leading-snug">
                                Dokumen ini bersifat rahasia dan resmi untuk lingkungan CV. Cahaya Cargo Express beserta mitra terkait.
                            </p>
                        </div>

                        {/* Signatory Area */}
                        <div className="w-[45%] text-center flex flex-col items-center">
                            
                            {/* Signature Stamp Image */}
                            <div className="h-[25mm] flex items-center justify-center my-1">
                                {showTtd ? (
                                    <img 
                                        src="/ttd.png" 
                                        alt="Tanda Tangan &amp; Stempel" 
                                        className="h-[25mm] w-auto object-contain"
                                    />
                                ) : (
                                    <div className="h-[20mm] w-[40mm] border border-dashed border-gray-300 rounded flex items-center justify-center text-[7pt] text-gray-300 no-print">
                                        Area Tanda Tangan
                                    </div>
                                )}
                            </div>

                            {/* Signatory Names */}
                            <span 
                                className="text-xs font-bold underline block outline-none"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setSignatoryName(e.currentTarget.textContent || '')}
                            >
                                {signatoryName}
                            </span>
                            <span 
                                className="text-[8pt] text-gray-600 block outline-none leading-tight"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setSignatoryRole(e.currentTarget.textContent || '')}
                            >
                                {signatoryRole}
                            </span>
                        </div>
                    </div>

                </div>

            </div>
            </div>
        </RouteGuard>
    );
}
