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
    Type,
    Layout,
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

    // Document Header Title state
    const [documentTitle, setDocumentTitle] = useState<string>('SURAT PERNYATAAN KOMITMEN BERSAMA');
    
    // Signatory states
    const [signatoryName, setSignatoryName] = useState<string>('HILAL BAFAGIH');
    const [signatoryRole, setSignatoryRole] = useState<string>('Operational Manager');

    // Lost items table state
    const [lostItems, setLostItems] = useState<LostItem[]>([]);

    // Document Metadata state (HTML string)
    const [documentMetadata, setDocumentMetadata] = useState<string>(
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

    // Document main body content state (HTML string)
    const [documentBody, setDocumentBody] = useState<string>(
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

    // Reset to Surat Pernyataan Komitmen Bersama
    const loadKomitmenTemplate = () => {
        if (confirm("Reset dokumen ke template Surat Pernyataan Komitmen Bersama? Perubahan yang belum dicetak akan hilang.")) {
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

    // Load Surat Penawaran Harga J&T
    const loadPenawaranTemplate = () => {
        if (confirm("Reset dokumen ke template Surat Penawaran Harga J&T? Perubahan yang belum dicetak akan hilang.")) {
            setDocumentTitle('SURAT PENAWARAN HARGA PENGIRIMAN CARGO LAUT');
            setSignatoryName('HILAL BAFAGIH');
            setSignatoryRole('Operational Manager');
            setLostItems([]);
            setDocumentMetadata(
                `<div class="grid grid-cols-12 gap-1 text-[10.5pt]">
                    <div class="col-span-2 font-semibold">No. Surat</div>
                    <div class="col-span-6">: 142/CCE-OPH/JT/VI/2026</div>
                    <div class="col-span-4 text-right font-semibold text-[10pt]">Surabaya, 28 Juni 2026</div>
                    
                    <div class="col-span-2 font-semibold">Sifat</div>
                    <div class="col-span-10">: Penting / Segera</div>
                    
                    <div class="col-span-2 font-semibold">Lampiran</div>
                    <div class="col-span-10">: -</div>
                    
                    <div class="col-span-2 font-semibold">Hal</div>
                    <div class="col-span-10 font-bold">: Penawaran Harga Pengiriman Cargo Via Kapal Laut</div>
                </div>
                <div class="mt-5 text-[10.5pt]">
                    <p>Kepada Yth.</p>
                    <p class="font-bold">Pimpinan Manajemen PT. LINTAS NUSANTARA JAYA (J&T Express / J&T Cargo)</p>
                    <p>Di Tempat</p>
                </div>`
            );
            setDocumentBody(
                `<p class="mt-4">Dengan hormat,</p>
                <p class="mt-2">Sehubungan dengan kebutuhan distribusi logistik yang andal dan aman, kami dari <strong>CV. Cahaya Cargo Express (CCE)</strong> dengan ini mengajukan penawaran tarif pengiriman cargo via kapal laut (kontainer LCL/FCL) dengan tarif khusus dan kompetitif untuk rute-rute utama sebagai berikut:</p>
                
                <table class="w-full text-left border-collapse mt-4 text-[10pt] border border-slate-300">
                    <thead>
                        <tr class="bg-slate-100 border-b border-slate-350 font-semibold text-slate-700">
                            <th class="p-3 border-r border-slate-300 w-[10%] text-center">No.</th>
                            <th class="p-3 border-r border-slate-300 w-[45%]">Rute Pengiriman</th>
                            <th class="p-3 border-r border-slate-300 w-[25%] text-center">Layanan / Media</th>
                            <th class="p-3 w-[20%] text-right font-bold text-slate-700">Tarif (Rp/kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-slate-300 hover:bg-slate-50/50">
                            <td class="p-3 border-r border-slate-300 text-center font-mono">1.</td>
                            <td class="p-3 border-r border-slate-300 font-semibold text-slate-900">Surabaya ke Makassar</td>
                            <td class="p-3 border-r border-slate-300 text-center text-slate-700">Kapal Laut</td>
                            <td class="p-3 text-right font-mono font-bold text-slate-900">Rp 2.200</td>
                        </tr>
                        <tr class="border-b border-slate-300 hover:bg-slate-50/50">
                            <td class="p-3 border-r border-slate-300 text-center font-mono">2.</td>
                            <td class="p-3 border-r border-slate-300 font-semibold text-slate-900">Surabaya ke Pare-Pare</td>
                            <td class="p-3 border-r border-slate-300 text-center text-slate-700">Kapal Laut</td>
                            <td class="p-3 text-right font-mono font-bold text-slate-900">Rp 2.600</td>
                        </tr>
                        <tr class="hover:bg-slate-50/50">
                            <td class="p-3 border-r border-slate-300 text-center font-mono">3.</td>
                            <td class="p-3 border-r border-slate-300 font-semibold text-slate-900">Makassar ke Surabaya</td>
                            <td class="p-3 border-r border-slate-300 text-center text-slate-700">Kapal Laut</td>
                            <td class="p-3 text-right font-mono font-bold text-slate-900">Rp 1.050</td>
                        </tr>
                    </tbody>
                </table>
                
                <h3 class="font-extrabold uppercase mt-6 mb-2 text-slate-900 text-[10pt]">Syarat dan Ketentuan Layanan:</h3>
                <ol class="list-decimal pl-5 space-y-2 text-[9.5pt]">
                    <li><strong>Minimal Berat Pengiriman:</strong> Batas minimal muatan adalah 100 kg per satu kali pengiriman.</li>
                    <li><strong>Sistem Pembayaran:</strong> Penagihan/invoice disesuaikan dengan kesepakatan tertulis (termin pembayaran mingguan atau bulanan).</li>
                    <li><strong>Penanganan Barang (Handling):</strong> Tarif di atas mencakup proses pemuatan barang di gudang asal dan pembongkaran di pelabuhan tujuan.</li>
                    <li><strong>Asuransi:</strong> Tarif di atas belum mencakup perlindungan asuransi kehilangan barang (opsional, disarankan untuk barang-barang bernilai tinggi).</li>
                    <li><strong>Lead Time Pengiriman:</strong> Waktu tempuh via armada kapal laut adalah 4-7 hari kerja terhitung sejak hari keberangkatan kapal.</li>
                </ol>
                <p class="mt-4 text-[9.5pt]">Besar harapan kami bahwa penawaran harga ini dapat menjadi landasan kerja sama kemitraan yang saling menguntungkan dan berkelanjutan di masa mendatang. Jika terdapat penyesuaian atau pertanyaan lebih lanjut, silakan hubungi tim kami.</p>`
            );
            setDocumentBodyEnd('');
        }
    };

    // Load Blank
    const loadBlankTemplate = () => {
        if (confirm("Kosongkan semua konten dokumen?")) {
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
                                    {/* Company name changed to black font */}
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
                                Dokumen ini bersifat rahasia dan internal untuk lingkungan CV. Cahaya Cargo Express beserta mitra pengawas terkait.
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
    );
}
