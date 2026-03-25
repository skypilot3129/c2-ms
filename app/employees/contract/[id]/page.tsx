'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getEmployee } from '@/lib/firestore-employees';
import type { Employee } from '@/types/employee';
import { useAuth } from '@/context/AuthContext';
import { Printer, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function ContractPrintPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, role, loading: authLoading } = useAuth();

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user || !['admin', 'pengurus'].includes(role)) {
            router.push('/');
            return;
        }

        const loadEmployee = async () => {
            try {
                if (typeof id === 'string') {
                    const data = await getEmployee(id);
                    setEmployee(data);
                }
            } catch (error) {
                console.error('Error loading employee:', error);
            } finally {
                setLoading(false);
            }
        };

        loadEmployee();
    }, [id, user, role, authLoading, router]);

    const handlePrint = () => {
        window.print();
    };

    if (loading || authLoading) {
        return <div className="p-12 text-center text-gray-500">Memuat data karyawan...</div>;
    }

    if (!employee) {
        return <div className="p-12 text-center text-red-500">Karyawan tidak ditemukan.</div>;
    }

    const todayDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div className="min-h-screen bg-gray-100 print:bg-white text-black font-serif">
            {/* Control Bar (Hidden on Print) */}
            <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10 p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => window.close()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft size={20} />
                        Tutup
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                    >
                        <Printer size={20} />
                        Cetak Kontrak
                    </button>
                </div>
            </div>

            {/* A4 Document Container */}
            <div className="max-w-4xl mx-auto bg-white my-8 print:my-0 shadow-lg print:shadow-none min-h-[297mm] p-[20mm]">

                {/* KOP Surat */}
                <div className="flex items-center justify-between border-b-4 border-black pb-6 mb-8">
                    <div className="w-1/4">
                        <Image
                            src="/logo.png"
                            alt="Cahaya Cargo Express"
                            width={150}
                            height={150}
                            className="object-contain drop-shadow"
                        />
                    </div>
                    <div className="w-3/4 text-center">
                        <h1 className="text-3xl font-extrabold text-[#d97706] tracking-tight uppercase">CAHAYA CARGO EXPRESS</h1>
                        <p className="text-sm font-medium mt-1">Jasa Ekspedisi Darat, Laut & Udara Terpercaya</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Jl. Raya Cargo No.88, Jakarta Barat, 11460 | Telp: (021) 555-1234<br />
                            Email: info@cahayacargo.com | Web: www.cahayacargo.com
                        </p>
                    </div>
                </div>

                {/* Surat Title */}
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold underline uppercase tracking-wide">SURAT PERJANJIAN KONTRAK KERJA</h2>
                    <p className="text-sm mt-1">No: {employee.employeeId}/SPK-CCE/{new Date().getFullYear()}</p>
                </div>

                {/* Opening */}
                <div className="space-y-4 text-sm leading-relaxed text-justify">
                    <p>
                        Pada hari ini, tanggal <strong>{todayDate}</strong>, yang bertanda tangan di bawah ini:
                    </p>

                    <div className="ml-4 space-y-2">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-8 align-top">1.</td>
                                    <td className="w-40 font-semibold align-top">Nama Perusahaan</td>
                                    <td className="w-2 align-top">:</td>
                                    <td>Cahaya Cargo Express</td>
                                </tr>
                                <tr>
                                    <td className="w-8 align-top"></td>
                                    <td className="w-40 font-semibold align-top">Alamat Domisili</td>
                                    <td className="w-2 align-top">:</td>
                                    <td>Jl. Raya Cargo No.88, Jakarta Barat</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="pt-2 text-gray-700 italic">
                                        Dalam hal ini bertindak untuk dan atas nama Cahaya Cargo Express, yang selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong>.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="ml-4 space-y-2 mt-4">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-8 align-top">2.</td>
                                    <td className="w-40 font-semibold align-top">Nama Lengkap</td>
                                    <td className="w-2 align-top">:</td>
                                    <td className="font-bold">{employee.fullName}</td>
                                </tr>
                                <tr>
                                    <td className="w-8 align-top"></td>
                                    <td className="w-40 font-semibold align-top">ID Karyawan</td>
                                    <td className="w-2 align-top">:</td>
                                    <td>{employee.employeeId}</td>
                                </tr>
                                <tr>
                                    <td className="w-8 align-top"></td>
                                    <td className="w-40 font-semibold align-top">No. KTP</td>
                                    <td className="w-2 align-top">:</td>
                                    <td>{employee.ktpIdentity?.nik || employee.documents?.find(d => d.type === 'KTP')?.number || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="w-8 align-top"></td>
                                    <td className="w-40 font-semibold align-top">No. HP / WA</td>
                                    <td className="w-2 align-top">:</td>
                                    <td>{employee.contact?.phone || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="w-8 align-top"></td>
                                    <td className="w-40 font-semibold align-top">Alamat Lengkap</td>
                                    <td className="w-2 align-top">:</td>
                                    <td>{employee.contact?.address || '-'}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="pt-2 text-gray-700 italic">
                                        Dalam hal ini bertindak untuk dan atas nama diri sendiri, yang selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong>.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-6">
                        PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama sepakat untuk mengikatkan diri dalam Perjanjian Kontrak Kerja dengan ketentuan dan syarat-syarat tertuang dalam pasal-pasal berikut:
                    </p>
                </div>

                {/* Pasal-Pasal */}
                <div className="mt-6 space-y-6 text-sm text-justify leading-relaxed">
                    <div>
                        <h3 className="font-bold text-base mb-1">Pasal 1: Jabatan dan Lingkup Kerja</h3>
                        <p>
                            PIHAK PERTAMA mempekerjakan PIHAK KEDUA sebagai karyawan dengan jabatan <strong>{employee.role.toUpperCase()}</strong>. PIHAK KEDUA wajib melaksanakan tugas dan kewajibannya sesuai dengan deskripsi pekerjaan (Jobdesk) yang ditetapkan oleh PIHAK PERTAMA dengan penuh tanggung jawab, dedikasi, dan jujur.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-base mb-1">Pasal 2: Waktu dan Kehadiran Kerja</h3>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Waktu kerja standar mengacu pada jadwal operasional yang ditetapkan oleh manajemen.</li>
                            <li>PIHAK KEDUA wajib melakukan presensi (Check In & Check Out) menggunakan sistem absensi yang disediakan PIHAK PERTAMA.</li>
                            <li>Keterlambatan tanpa alasan yang sah dan disetujui dapat berakibat pada pemotongan gaji / denda sesuai dengan kebijakan perusahaan.</li>
                        </ol>
                    </div>

                    {employee.role === 'helper' && (
                        <div>
                            <h3 className="font-bold text-base mb-1">Pasal 3: Kompensasi dan Denda Khusus (Helper)</h3>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>Nilai upah harian PIHAK KEDUA ditetapkan sebesar <strong>Rp 50.000,-</strong> (Lima Puluh Ribu Rupiah) per hari absensi kehadiran.</li>
                                <li>Keterlambatan 1 - 2 Jam akan dikenakan denda potong gaji sebesar <strong>Rp 10.000,-</strong>. Keterlambatan lebih dari 2 Jam akan dipotong <strong>Rp 20.000,-</strong>.</li>
                                <li>Pembagian operasional muatan: dari Rp 700.000,- per truk keluar, PIHAK KEDUA berhak menerima alokasi yang dibagikan merata ke seluruh Tim Muat. Jika ditunjuk sebagai Penyusun (Stacker), PIHAK KEDUA berhak atas tambahan <strong>Rp 50.000,-</strong>.</li>
                            </ol>
                        </div>
                    )}

                    {employee.role !== 'helper' && (
                        <div>
                            <h3 className="font-bold text-base mb-1">Pasal 3: Kompensasi dan Tunjangan</h3>
                            <p>
                                PIHAK KEDUA berhak menerima Gaji Pokok sebesar <strong>Rp {employee.salaryConfig?.baseSalary?.toLocaleString('id-ID') || '0'}</strong> setiap bulan, dibayarkan pada tanggal cut-off payroll yang disepakati. Tunjangan lain (seperti kehadiran, makan, jabatan) dibayarkan sesuai dengan catatan absensi bulan berjalan.
                            </p>
                        </div>
                    )}

                    <div>
                        <h3 className="font-bold text-base mb-1">Pasal 4: Pemutusan Hubungan Kerja (PHK)</h3>
                        <p>
                            Pihak Pertama berhak melakukan Pemutusan Hubungan Kerja (PHK) secara sepihak apabila Pihak Kedua melakukan pelanggaran berat berupa: pencurian, penggelapan dana bongkar muat, mabuk-mabukan di area kerja, manipulasi absensi, atau memberikan kerusakan yang disengaja pada armada dan properti perusahaan.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-base mb-1">Pasal 5: Penutup</h3>
                        <p>
                            Demikian Surat Perjanjian Kerja ini dibuat dan ditandatangani oleh kedua belah pihak di atas kertas bermaterai dalam keadaan sadar, sehat jasmani dan rohani, serta tanpa adanya paksaan dari pihak manapun.
                        </p>
                    </div>
                </div>

                {/* Signatures */}
                <div className="mt-16 flex justify-between text-center text-sm px-8">
                    <div>
                        <p className="mb-24">PIHAK PERTAMA</p>
                        <p className="font-bold underline uppercase">Bpk. Hilal Bafagih</p>
                        <p className="text-gray-600">Direktur / Owner</p>
                    </div>
                    <div>
                        <p className="mb-24">PIHAK KEDUA</p>
                        <p className="font-bold underline uppercase">{employee.fullName}</p>
                        <p className="text-gray-600">{employee.role.toUpperCase()}</p>
                    </div>
                </div>

            </div>
        </div>
    );
}

