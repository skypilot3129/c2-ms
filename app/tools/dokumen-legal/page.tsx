'use client';

import { useState } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/lib/company-config';
import { 
    Printer, 
    ArrowLeft, 
    Eye, 
    EyeOff, 
    Plus, 
    Trash2, 
    RotateCcw, 
    FileText, 
    Layout, 
    Type,
    FileSpreadsheet,
    FileSignature
} from 'lucide-react';

interface LostItem {
    resi: string;
    order: string;
    notes: string;
}

export default function DokumenLegalPage() {
    // Layout and Display options states
    const [showKop, setShowKop] = useState<boolean>(true);
    const [showTtd, setShowTtd] = useState<boolean>(true);
    const [fontSize, setFontSize] = useState<string>('11pt');
    const [paddingSize, setPaddingSize] = useState<string>('20mm');
    const [lineHeight, setLineHeight] = useState<string>('1.5');
    const [fontFamily, setFontFamily] = useState<string>('sans');

    // Document Metadata states
    const [documentDate, setDocumentDate] = useState<string>('09 Juni 2026');
    const [refNumber, setRefNumber] = useState<string>('024/CCE-INV/VI/2026');
    const [documentTitle, setDocumentTitle] = useState<string>('LAPORAN INVESTIGASI & KRONOLOGI KEHILANGAN BARANG');
    
    // Signatory states
    const [signatoryName, setSignatoryName] = useState<string>('HILAL BAFAGIH');
    const [signatoryRole, setSignatoryRole] = useState<string>('Operational Manager');

    // Lost items table state
    const [lostItems, setLostItems] = useState<LostItem[]>([
        { resi: 'SPXID065039708555', order: 'TO202605293D9ZG', notes: '-' },
        { resi: 'SPXID068337159165', order: 'TO202605293EGRI', notes: '-' },
        { resi: 'SPXID064487229745', order: 'TO202605293EI4A', notes: '-' },
        { resi: 'SPXID066533886485', order: 'TO202605293D9ZG', notes: '-' },
        { resi: 'SPXID069867400215', order: 'TO202605293D9ZG', notes: '-' },
        { resi: 'SPXID066094989675', order: 'TO202605293ENSI', notes: '-' },
        { resi: 'SPXID061571645185', order: 'TO202605293EDKC', notes: '-' }
    ]);

    // Section text contents states (HTML strings)
    const [executiveSummary, setExecutiveSummary] = useState<string>(
        `<p>Laporan ini disusun berdasarkan adanya laporan kehilangan barang (Data LT) yang diterima oleh PT Duta Hantaran Surabaya (DHS) pada tanggal 08 Juni 2026. Kehilangan ini merujuk pada proses pemuatan barang yang dilakukan pada tanggal 29 Mei 2026 dari CCE Surabaya dengan tujuan akhir Maros DC melalui Cabang Makassar.</p>
        <p class="mt-2">Laporan ini bertujuan untuk memetakan alur perjalanan barang, mengidentifikasi pihak-pihak yang terlibat, serta menganalisis beberapa kejanggalan administratif dan operasional yang ditemukan di lapangan guna menentukan titik terjadinya selisih barang.</p>`
    );

    const [shippingDetails, setShippingDetails] = useState<string>(
        `<div>
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
        </div>`
    );

    const [chronologyText, setChronologyText] = useState<string>(
        `<ul class="list-disc pl-5 space-y-2">
            <li><strong>29 Mei 2026 (Proses Pemuatan di CCE Surabaya):</strong>
                <ul class="list-circle pl-5 mt-1 space-y-1">
                    <li>Proses pemuatan barang dilakukan dengan pengawasan ketat secara langsung oleh 4 (empat) orang pengawas dari DHS dan CCE.</li>
                    <li>Dilakukan pengemasan khusus untuk Barang Mahal (Barhal) ke dalam 2 (dua) karung khusus yang masing-masing berisi 8 TO (Total 16 TO).</li>
                    <li><strong>Bukti Pengawasan:</strong> Pengawas DHS dan CCE bekerja sama mendokumentasikan proses pengisian Barhal ke dalam karung melalui rekaman video.</li>
                    <li>Barang dimuat ke unit pertama (Fuso DD 8250 LQ - Driver: Riswan) dan kemudian dilansir/dipindahkan ke unit kedua (B 9521 GO - Driver: Alvian).</li>
                </ul>
            </li>
            <li class="mt-3"><strong>Perjalanan & Pembongkaran di Cabang Makassar:</strong>
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

    const [analysisText, setAnalysisText] = useState<string>(
        `<ol class="list-decimal pl-5 space-y-4">
            <li><strong>Status Validitas "Barang Mahal" (Barhal)</strong>
                <p class="mt-1"><strong>Temuan:</strong> Data resi/TO yang dilaporkan hilang di atas tidak sama dengan data TO Barhal yang disiapkan dan dimasukkan ke dalam 2 karung segel di CCE Surabaya.</p>
                <p class="mt-1"><strong>Pertanyaan:</strong> Apakah 7 barang yang dilaporkan hilang tersebut memang dikategorikan sebagai Barang Mahal? Jika benar Barhal, mengapa nomor TO-nya tidak cocok dengan daftar Barhal yang dikoordinasikan saat pemuatan? Mengingat 2 karung Barhal tiba di Makassar dalam kondisi segel utuh, maka besar kemungkinan barang yang hilang ini berada di luar karung segel tersebut (karung reguler).</p>
            </li>
            <li class="mt-3"><strong>Karakteristik Fisik Barang & Pengawasan Lapangan</strong>
                <p class="mt-1"><strong>Temuan:</strong> Kehilangan berjumlah 7 koli/paket. Jika ini merupakan barang ukuran besar (bulky) atau karung biasa di luar segel Barhal, pemindahannya secara ilegal (tindakan kriminal atau kelalaian) di lokasi asal seharusnya sangat sulit terjadi.</p>
                <p class="mt-1"><strong>Pertanyaan:</strong> Apakah barang tersebut merupakan barang bulky atau karung biasa? Selama proses pemuatan di CCE Surabaya, terdapat 4 (empat) orang pengawas fisik yang siaga (Pak Aan, Pak Fauzan, Pak Indar, dan Pak Ali). Jika terjadi kejanggalan atau tindakan mencurigakan pada fase pemuatan, bagaimana hal tersebut bisa lolos dari pengawasan langsung empat orang personel tersebut?</p>
            </li>
            <li class="mt-3"><strong>Selisih Hitung Koli & Potensi Kerusakan Kemasan (Surabaya - Makassar - Maros DC)</strong>
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

    // Load templates
    const loadInvestigasiTemplate = () => {
        if (confirm("Reset dokumen ke template Laporan Investigasi? Perubahan yang belum dicetak akan hilang.")) {
            setDocumentTitle('LAPORAN INVESTIGASI & KRONOLOGI KEHILANGAN BARANG');
            setDocumentDate('09 Juni 2026');
            setRefNumber('024/CCE-INV/VI/2026');
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
            setExecutiveSummary(
                `<p>Laporan ini disusun berdasarkan adanya laporan kehilangan barang (Data LT) yang diterima oleh PT Duta Hantaran Surabaya (DHS) pada tanggal 08 Juni 2026. Kehilangan ini merujuk pada proses pemuatan barang yang dilakukan pada tanggal 29 Mei 2026 dari CCE Surabaya dengan tujuan akhir Maros DC melalui Cabang Makassar.</p>
                <p class="mt-2">Laporan ini bertujuan untuk memetakan alur perjalanan barang, mengidentifikasi pihak-pihak yang terlibat, serta menganalisis beberapa kejanggalan administratif dan operasional yang ditemukan di lapangan guna menentukan titik terjadinya selisih barang.</p>`
            );
            setShippingDetails(
                `<div>
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
                </div>`
            );
            setChronologyText(
                `<ul class="list-disc pl-5 space-y-2">
                    <li><strong>29 Mei 2026 (Proses Pemuatan di CCE Surabaya):</strong>
                        <ul class="list-circle pl-5 mt-1 space-y-1">
                            <li>Proses pemuatan barang dilakukan dengan pengawasan ketat secara langsung oleh 4 (empat) orang pengawas dari DHS dan CCE.</li>
                            <li>Dilakukan pengemasan khusus untuk Barang Mahal (Barhal) ke dalam 2 (dua) karung khusus yang masing-masing berisi 8 TO (Total 16 TO).</li>
                            <li><strong>Bukti Pengawasan:</strong> Pengawas DHS dan CCE bekerja sama mendokumentasikan proses pengisian Barhal ke dalam karung melalui rekaman video.</li>
                            <li>Barang dimuat ke unit pertama (Fuso DD 8250 LQ - Driver: Riswan) dan kemudian dilansir/dipindahkan ke unit kedua (B 9521 GO - Driver: Alvian).</li>
                        </ul>
                    </li>
                    <li class="mt-3"><strong>Perjalanan & Pembongkaran di Cabang Makassar:</strong>
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
            setAnalysisText(
                `<ol class="list-decimal pl-5 space-y-4">
                    <li><strong>Status Validitas "Barang Mahal" (Barhal)</strong>
                        <p class="mt-1"><strong>Temuan:</strong> Data resi/TO yang dilaporkan hilang di atas tidak sama dengan data TO Barhal yang disiapkan dan dimasukkan ke dalam 2 karung segel di CCE Surabaya.</p>
                        <p class="mt-1"><strong>Pertanyaan:</strong> Apakah 7 barang yang dilaporkan hilang tersebut memang dikategorikan sebagai Barang Mahal? Jika benar Barhal, mengapa nomor TO-nya tidak cocok dengan daftar Barhal yang dikoordinasikan saat pemuatan? Mengingat 2 karung Barhal tiba di Makassar dalam kondisi segel utuh, maka besar kemungkinan barang yang hilang ini berada di luar karung segel tersebut (karung reguler).</p>
                    </li>
                    <li class="mt-3"><strong>Karakteristik Fisik Barang & Pengawasan Lapangan</strong>
                        <p class="mt-1"><strong>Temuan:</strong> Kehilangan berjumlah 7 koli/paket. Jika ini merupakan barang ukuran besar (bulky) atau karung biasa di luar segel Barhal, pemindahannya secara ilegal (tindakan kriminal atau kelalaian) di lokasi asal seharusnya sangat sulit terjadi.</p>
                        <p class="mt-1"><strong>Pertanyaan:</strong> Apakah barang tersebut merupakan barang bulky atau karung biasa? Selama proses pemuatan di CCE Surabaya, terdapat 4 (empat) orang pengawas fisik yang siaga (Pak Aan, Pak Fauzan, Pak Indar, dan Pak Ali). Jika terjadi kejanggalan atau tindakan mencurigakan pada fase pemuatan, bagaimana hal tersebut bisa lolos dari pengawasan langsung empat orang personel tersebut?</p>
                    </li>
                    <li class="mt-3"><strong>Selisih Hitung Koli & Potensi Kerusakan Kemasan (Surabaya - Makassar - Maros DC)</strong>
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

    const loadSuratKeteranganTemplate = () => {
        if (confirm("Reset dokumen ke template Surat Keterangan? Perubahan yang belum dicetak akan hilang.")) {
            setDocumentTitle('SURAT KETERANGAN JALAN ARMADA');
            setDocumentDate('09 Juni 2026');
            setRefNumber('015/CCE-SK/VI/2026');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);
            setExecutiveSummary(
                `<p>Dengan ini Direksi CV. Cahaya Cargo Express menerangkan bahwa armada yang tercantum di bawah ini berada dalam tugas operasional resmi pengangkutan logistik lintas cabang:</p>`
            );
            setShippingDetails(
                `<div>
                    <h4 class="font-bold underline text-gray-800">Detail Kendaraan & Driver</h4>
                    <div class="ml-4 mt-2 space-y-1 text-gray-700">
                        <p><strong>Nama Driver:</strong> Riswan</p>
                        <p><strong>Nomor Polisi:</strong> DD 8250 LQ</p>
                        <p><strong>Jenis Unit:</strong> Mitsubishi Fuso Long</p>
                        <p><strong>Rute Perjalanan:</strong> Surabaya - Makassar (Via Tanjung Perak)</p>
                    </div>
                </div>`
            );
            setChronologyText(
                `<p>Surat keterangan ini diberikan kepada yang bersangkutan untuk dipergunakan sebagai bukti jalan yang sah dan sebagai dokumen pendukung pemeriksaan pos jembatan timbang maupun pelabuhan.</p>
                <p class="mt-2">Demikian surat keterangan ini dibuat dengan sebenarnya untuk digunakan sebagaimana mestinya.</p>`
            );
            setAnalysisText('');
        }
    };

    const loadBlankTemplate = () => {
        if (confirm("Kosongkan semua konten dokumen?")) {
            setDocumentTitle('JUDUL DOKUMEN RESMI');
            setDocumentDate('09 Juni 2026');
            setRefNumber('.../.../.../2026');
            setLostItems([]);
            setExecutiveSummary('<p>Tulis paragraf pembuka atau isi dokumen di sini...</p>');
            setShippingDetails('<p>Tulis detail pengiriman atau poin penting di sini...</p>');
            setChronologyText('<p>Tulis kronologi atau detail peristiwa di sini...</p>');
            setAnalysisText('');
        }
    };

    return (
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
                        padding: ${paddingSize} !important;
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
                        margin: 0;
                    }
                }
                `
            }} />

            {/* Left Sidebar Control Panel (no-print) */}
            <div className="no-print w-full md:w-96 bg-slate-900 text-white p-6 md:min-h-screen flex flex-col gap-6 shadow-xl border-r border-slate-800 z-20">
                
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <FileSignature className="text-emerald-400" size={24} />
                        <span className="font-bold text-lg">Cetak Dokumen Legal</span>
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

                {/* Templates Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Template Dokumen</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button 
                            onClick={loadInvestigasiTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center"
                            title="Laporan Kehilangan"
                        >
                            Investigasi
                        </button>
                        <button 
                            onClick={loadSuratKeteranganTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-center"
                            title="Surat Keterangan"
                        >
                            Suket
                        </button>
                        <button 
                            onClick={loadBlankTemplate}
                            className="bg-slate-800 hover:bg-red-900/40 text-xs font-semibold py-2 px-1 rounded-lg border border-slate-700 hover:border-red-900/60 transition-all text-center text-red-300"
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
                                    <h2 className="text-xl md:text-2xl font-extrabold text-blue-900 tracking-wider font-serif">
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

                    {/* 2. DOKUMEN HEADER */}
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
                        <div className="mt-2 text-xs flex justify-center gap-6">
                            <div>
                                <span className="font-semibold">No. Ref: </span>
                                <span 
                                    contentEditable 
                                    suppressContentEditableWarning
                                    onBlur={(e) => setRefNumber(e.currentTarget.textContent || '')}
                                    className="border-b border-dashed border-gray-400 outline-none"
                                >
                                    {refNumber}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold">Tanggal: </span>
                                <span 
                                    contentEditable 
                                    suppressContentEditableWarning
                                    onBlur={(e) => setDocumentDate(e.currentTarget.textContent || '')}
                                    className="border-b border-dashed border-gray-400 outline-none"
                                >
                                    {documentDate}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. DOKUMEN BODY CONTENT */}
                    <div className="space-y-6 text-justify text-xs md:text-sm">
                        
                        {/* Section I: Executive Summary */}
                        <div>
                            <h3 className="font-extrabold uppercase mb-2 text-gray-900">I. RINGKASAN EKSEKUTIF</h3>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setExecutiveSummary(e.currentTarget.innerHTML || '')}
                                style={{ outline: 'none', cursor: 'text' }}
                                dangerouslySetInnerHTML={{ __html: executiveSummary }}
                                className="border border-transparent hover:border-dashed hover:border-gray-300 p-1 rounded transition-colors"
                            />
                        </div>

                        {/* Section II: Shipping Details */}
                        <div>
                            <h3 className="font-extrabold uppercase mb-2 text-gray-900">II. DETAIL PENGIRIMAN &amp; PIHAK TERKAIT</h3>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setShippingDetails(e.currentTarget.innerHTML || '')}
                                style={{ outline: 'none', cursor: 'text' }}
                                dangerouslySetInnerHTML={{ __html: shippingDetails }}
                                className="border border-transparent hover:border-dashed hover:border-gray-300 p-1 rounded transition-colors"
                            />
                        </div>

                        {/* Section III: Chronology */}
                        <div>
                            <h3 className="font-extrabold uppercase mb-2 text-gray-900">III. KRONOLOGI PERJALANAN BARANG</h3>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setChronologyText(e.currentTarget.innerHTML || '')}
                                style={{ outline: 'none', cursor: 'text' }}
                                dangerouslySetInnerHTML={{ __html: chronologyText }}
                                className="border border-transparent hover:border-dashed hover:border-gray-300 p-1 rounded transition-colors"
                            />
                        </div>

                        {/* Section IV: Lost Items Table */}
                        {lostItems.length > 0 && (
                            <div>
                                <h3 className="font-extrabold uppercase mb-2 text-gray-900">IV. DATA BARANG YANG DILAPORKAN HILANG (DATA LT)</h3>
                                <p className="mb-2">
                                    Berdasarkan laporan Data LT dengan nomor referensi <span className="font-mono font-semibold">LT0Q5T1HRGJE1</span>, berikut adalah rincian {lostItems.length} (tiga) barang yang dilaporkan hilang:
                                </p>
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

                        {/* Section V: Analysis */}
                        {analysisText && (
                            <div>
                                <h3 className="font-extrabold uppercase mb-2 text-gray-900">V. ANALISIS TEMUAN &amp; PERTANYAAN KUNCI (DISCREPANCIES)</h3>
                                <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => setAnalysisText(e.currentTarget.innerHTML || '')}
                                    style={{ outline: 'none', cursor: 'text' }}
                                    dangerouslySetInnerHTML={{ __html: analysisText }}
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
                                Dokumen ini bersifat rahasia dan internal untuk lingkungan CV. Cahaya Cargo Express beserta mitra pengawas terkait.
                            </p>
                        </div>

                        {/* Signatory Area */}
                        <div className="w-[45%] text-center flex flex-col items-center">
                            <p className="text-xs mb-1">Dibuat Oleh / Hormat Kami,</p>
                            <p className="text-xs font-bold text-gray-900">CV. CAHAYA CARGO EXPRESS</p>
                            
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
    );
}
