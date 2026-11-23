'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    updateDoc,
} from 'firebase/firestore';
import { ROLE_LABELS, type UserRole } from '@/types/roles';
import {
    DEFAULT_WA_AGENT_CONFIG,
    normalizeWaPhone,
    type PendingAction,
    type WaAgentConfig,
    type WaAgentLog,
    type WaAgentRole,
    type WaAgentUser,
} from '@/types/wa-agent';
import {
    Activity,
    ArrowLeft,
    Bot,
    CheckCircle2,
    Copy,
    ImagePlus,
    Power,
    RefreshCw,
    Send,
    Shield,
    Trash2,
    UserPlus,
    Wifi,
    WifiOff,
    X,
} from 'lucide-react';

interface HealthStatus {
    geminiConfigured: boolean;
    webhookSecretConfigured: boolean;
    openwaApiKeyConfigured: boolean;
    openwa: {
        reachable: boolean;
        statusCode?: number;
        message: string;
        baseUrl: string;
        sessionId: string;
    };
}

interface SimMessage {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    toolsUsed?: string[];
    imagePreview?: string;
}

const QUICK_PROMPTS = [
    'Buat pemberangkatan baru Surabaya - Makassar kapal KM Dharma Kencana VII, unit sopir Budi & L 9988 AB, berangkat hari ini, status berlayar',
    'Cek STT pending terbaru, usulkan harga dari riwayat, dan ubah status ke dikirim',
    'Cek piutang belum lunas',
    'Ringkasan omzet kapal terbaru',
    'Cek STT belum dibuat invoice',
    'Input STT cabang Surabaya, pengirim DHS, penerima Toko Maju tujuan Makassar, 5 koli 100 kg, harga 2500 per kg, isi barang konveksi, pembayaran kredit',
    'Buatkan invoice untuk DHS dari STT yang belum ditagih',
];

const GEMINI_MODEL_OPTIONS = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Stabil & Efisien)' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
] as const;

export default function WhatsAppAgentAdminPage() {
    const { user, role, employee } = useAuth();
    const isOwner = role === 'owner' || (!employee && Boolean(user));
    const isAuthorized = isOwner || role === 'admin';

    // Config & Health
    const [config, setConfig] = useState<WaAgentConfig>(DEFAULT_WA_AGENT_CONFIG);
    const [savingConfig, setSavingConfig] = useState(false);
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [checkingHealth, setCheckingHealth] = useState(false);

    // Whitelist users
    const [waUsers, setWaUsers] = useState<WaAgentUser[]>([]);
    const [newPhone, setNewPhone] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<WaAgentRole>('admin');
    const [addingUser, setAddingUser] = useState(false);

    // Logs
    const [logs, setLogs] = useState<WaAgentLog[]>([]);

    // Simulator
    const [simRole, setSimRole] = useState<WaAgentRole>('owner');
    const [simInput, setSimInput] = useState('');
    const [simSending, setSimSending] = useState(false);
    const [simPending, setSimPending] = useState<PendingAction | null>(null);
    const [simMedia, setSimMedia] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
    const [simMessages, setSimMessages] = useState<SimMessage[]>([
        {
            id: 'welcome',
            sender: 'bot',
            text: 'Halo! Saya Asisten AI CCE. Anda bisa langsung uji coba tanya omzet kapal, cek resi/piutang, input STT dari teks/foto nota, atau buat draft invoice di sini.',
        },
    ]);

    const [copiedWebhook, setCopiedWebhook] = useState(false);

    const fetchHealth = async () => {
        if (!user) return;
        setCheckingHealth(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/whatsapp/health', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setHealth(data);
            }
        } catch (err) {
            console.error('Failed checking WA Agent health:', err);
        } finally {
            setCheckingHealth(false);
        }
    };

    useEffect(() => {
        if (!user || !isAuthorized) return;

        fetchHealth();

        const unsubCfg = onSnapshot(doc(db, 'settings', 'wa_agent_config'), (snap) => {
            if (snap.exists()) {
                const d = snap.data() || {};
                setConfig({
                    enabled: Boolean(d.enabled),
                    openwaBaseUrl: d.openwaBaseUrl || DEFAULT_WA_AGENT_CONFIG.openwaBaseUrl,
                    openwaSessionId: d.openwaSessionId || DEFAULT_WA_AGENT_CONFIG.openwaSessionId,
                    allowGroups: Boolean(d.allowGroups),
                    groupPrefix: d.groupPrefix || '/cce',
                    modelName: d.modelName || DEFAULT_WA_AGENT_CONFIG.modelName,
                });
            }
        });

        const unsubUsers = onSnapshot(collection(db, 'wa_agent_users'), (snap) => {
            const list: WaAgentUser[] = snap.docs
                .map((d) => {
                    const data = d.data() || {};
                    return {
                        id: d.id,
                        phone: String(data.phone || ''),
                        name: String(data.name || ''),
                        role: (data.role as UserRole) || 'helper',
                        active: Boolean(data.active),
                        notes: data.notes ? String(data.notes) : undefined,
                        createdAt: data.createdAt?.toDate?.() || new Date(),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(),
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
            setWaUsers(list);
        });

        const logsQ = query(collection(db, 'wa_agent_logs'), orderBy('createdAt', 'desc'), limit(30));
        const unsubLogs = onSnapshot(logsQ, (snap) => {
            const list: WaAgentLog[] = snap.docs.map((d) => {
                const data = d.data() || {};
                return {
                    id: d.id,
                    messageId: data.messageId,
                    phone: String(data.phone || ''),
                    userName: data.userName,
                    userRole: data.userRole,
                    source: data.source || 'whatsapp',
                    incomingText: String(data.incomingText || ''),
                    replyText: String(data.replyText || ''),
                    toolsUsed: Array.isArray(data.toolsUsed) ? data.toolsUsed : [],
                    status: data.status || 'ok',
                    errorMessage: data.errorMessage,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                };
            });
            setLogs(list);
        });

        return () => {
            unsubCfg();
            unsubUsers();
            unsubLogs();
        };
    }, [user, isAuthorized]);

    const saveConfig = async (nextConfig: WaAgentConfig) => {
        setSavingConfig(true);
        try {
            await setDoc(
                doc(db, 'settings', 'wa_agent_config'),
                {
                    enabled: nextConfig.enabled,
                    openwaBaseUrl: nextConfig.openwaBaseUrl.trim().replace(/\/+$/, '') || 'http://localhost:2785',
                    openwaSessionId: nextConfig.openwaSessionId.trim() || 'cce-admin',
                    allowGroups: nextConfig.allowGroups,
                    groupPrefix: nextConfig.groupPrefix.trim() || '/cce',
                    modelName: nextConfig.modelName.trim() || 'gemini-2.5-flash',
                    updatedAt: Timestamp.now(),
                },
                { merge: true }
            );
            await fetchHealth();
        } catch (err) {
            console.error('Failed saving config:', err);
            alert('Gagal menyimpan konfigurasi AI Agent.');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleToggleEnabled = async () => {
        const next = { ...config, enabled: !config.enabled };
        setConfig(next);
        await saveConfig(next);
    };

    const handleAddWhitelistUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalized = normalizeWaPhone(newPhone);
        if (!normalized || normalized.length < 9 || !newName.trim()) {
            alert('Masukkan nomor WhatsApp yang valid (mis. 08123456789) dan nama staf.');
            return;
        }
        if (waUsers.some((u) => u.phone === normalized)) {
            alert(`Nomor ${normalized} sudah terdaftar di whitelist.`);
            return;
        }

        setAddingUser(true);
        try {
            const now = Timestamp.now();
            await addDoc(collection(db, 'wa_agent_users'), {
                phone: normalized,
                name: newName.trim(),
                role: newRole,
                active: true,
                createdAt: now,
                updatedAt: now,
            });
            setNewPhone('');
            setNewName('');
        } catch (err) {
            console.error('Error adding whitelist user:', err);
            alert('Gagal menambahkan nomor WA.');
        } finally {
            setAddingUser(false);
        }
    };

    const handleToggleUserActive = async (item: WaAgentUser) => {
        await updateDoc(doc(db, 'wa_agent_users', item.id), {
            active: !item.active,
            updatedAt: Timestamp.now(),
        });
    };

    const handleDeleteUser = async (item: WaAgentUser) => {
        if (!confirm(`Hapus akses AI WhatsApp untuk ${item.name} (${item.phone})?`)) return;
        await deleteDoc(doc(db, 'wa_agent_users', item.id));
    };

    const handleSelectSimImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.replace(/^data:[^;]+;base64,/, '');
            setSimMedia({
                base64,
                mimeType: file.type || 'image/jpeg',
                previewUrl: result,
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const sendSimulatorMessage = async (overrideText?: string) => {
        if (!user || simSending) return;
        const textToSend = (overrideText !== undefined ? overrideText : simInput).trim();
        if (!textToSend && !simMedia) return;

        const mediaPayload = simMedia ? { base64: simMedia.base64, mimeType: simMedia.mimeType } : undefined;
        const previewImg = simMedia?.previewUrl;

        setSimMessages((prev) => [
            ...prev,
            {
                id: `u_${Date.now()}`,
                sender: 'user',
                text: textToSend || '(Mengirim gambar/nota)',
                imagePreview: previewImg,
            },
        ]);
        if (overrideText === undefined) setSimInput('');
        setSimMedia(null);
        setSimSending(true);

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/whatsapp/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    phone: '6280000000000',
                    role: simRole,
                    name: user.displayName || user.email || 'Admin Simulator',
                    text: textToSend,
                    media: mediaPayload,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Request gagal');
            }
            setSimPending(data.pendingAction || null);
            const firstMedia = Array.isArray(data.replyMedia) ? data.replyMedia[0] : undefined;
            const mediaPreview =
                firstMedia?.base64 && firstMedia?.mimeType
                    ? `data:${firstMedia.mimeType};base64,${firstMedia.base64}`
                    : undefined;
            setSimMessages((prev) => [
                ...prev,
                {
                    id: `b_${Date.now()}`,
                    sender: 'bot',
                    text: data.replyText || 'Tidak ada respons.',
                    toolsUsed: data.toolsUsed || [],
                    imagePreview: mediaPreview,
                },
            ]);
        } catch (err: any) {
            setSimMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    sender: 'bot',
                    text: `Error Simulator: ${err?.message || 'Gagal memproses pesan'}`,
                },
            ]);
        } finally {
            setSimSending(false);
        }
    };

    const handleCopyWebhookUrl = () => {
        navigator.clipboard.writeText('http://host.docker.internal:3000/api/whatsapp/webhook');
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2500);
    };

    return (
        <ProtectedRoute>
            {!isAuthorized ? (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center max-w-md space-y-3">
                        <Shield className="mx-auto text-red-500" size={36} />
                        <h2 className="text-lg font-bold text-slate-900">Akses Khusus Owner & Admin</h2>
                        <p className="text-sm text-slate-500">
                            Halaman pengaturan AI Agent WhatsApp hanya dapat diakses oleh Owner atau Administrator.
                        </p>
                        <Link href="/" className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold">
                            Kembali ke Home
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="min-h-screen bg-slate-50 pb-16">
                    {/* Header */}
                    <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-blue-600 inline-flex items-center gap-1 mb-1">
                                    <ArrowLeft size={14} /> Kembali ke Home
                                </Link>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                                        <Bot size={20} />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-black text-slate-900">AI Agent WhatsApp (OpenWA)</h1>
                                        <p className="text-xs text-slate-500">
                                            Kontrol gateway OpenWA komputer kantor, whitelist nomor staf &amp; simulator karyawan AI
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={fetchHealth}
                                    disabled={checkingHealth}
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                                >
                                    <RefreshCw size={14} className={checkingHealth ? 'animate-spin' : ''} />
                                    Cek Koneksi
                                </button>
                                <button
                                    type="button"
                                    onClick={handleToggleEnabled}
                                    disabled={savingConfig}
                                    className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-colors shadow-sm ${
                                        config.enabled
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                    }`}
                                >
                                    <Power size={15} />
                                    {config.enabled ? 'Agent: AKTIF' : 'Agent: NONAKTIF'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                        {/* Health Status Row */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500">OpenWA Server</span>
                                    {health?.openwa.reachable ? (
                                        <Wifi size={16} className="text-emerald-600" />
                                    ) : (
                                        <WifiOff size={16} className="text-amber-500" />
                                    )}
                                </div>
                                <p className={`text-sm font-black mt-1 ${health?.openwa.reachable ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {health ? (health.openwa.reachable ? 'Terhubung' : 'Belum Aktif') : 'Memeriksa...'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={health?.openwa.message}>
                                    {health?.openwa.message || config.openwaBaseUrl}
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                                <span className="text-xs font-bold text-slate-500">Otak AI (Gemini)</span>
                                <p className={`text-sm font-black mt-1 ${health?.geminiConfigured ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {health ? (health.geminiConfigured ? 'API Key Siap' : 'API Key Kosong') : 'Memeriksa...'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Model: {config.modelName}</p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                                <span className="text-xs font-bold text-slate-500">Keamanan Webhook</span>
                                <p className={`text-sm font-black mt-1 ${health?.webhookSecretConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {health ? (health.webhookSecretConfigured ? 'Secret Aktif' : 'Belum Diset (.env.local)') : 'Memeriksa...'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    API Key OpenWA: {health?.openwaApiKeyConfigured ? 'Ada' : 'Belum diisi'}
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                                <span className="text-xs font-bold text-slate-500">Nomor Staf Diizinkan</span>
                                <p className="text-2xl font-black text-slate-900 mt-0.5">
                                    {waUsers.filter((u) => u.active).length} <span className="text-xs font-semibold text-slate-400">/ {waUsers.length} terdaftar</span>
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Session: {config.openwaSessionId}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Left Column: Config + Whitelist */}
                            <div className="lg:col-span-5 space-y-6">
                                {/* Config Form */}
                                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                                    <h2 className="font-black text-slate-900 text-base">Konfigurasi Gateway &amp; Grup</h2>

                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">Webhook URL untuk OpenWA Docker</span>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs font-mono text-blue-700 truncate flex-1">
                                                http://host.docker.internal:3000/api/whatsapp/webhook
                                            </code>
                                            <button
                                                type="button"
                                                onClick={handleCopyWebhookUrl}
                                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0"
                                            >
                                                <Copy size={12} />
                                                {copiedWebhook ? 'Tersalin' : 'Salin'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            Panduan lengkap setup Docker kantor tersedia di <code>wa-agent/SETUP-KANTOR.md</code>.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="font-bold text-slate-600 block mb-1">OpenWA URL</label>
                                            <input
                                                type="text"
                                                value={config.openwaBaseUrl}
                                                onChange={(e) => setConfig({ ...config, openwaBaseUrl: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="font-bold text-slate-600 block mb-1">Session ID</label>
                                            <input
                                                type="text"
                                                value={config.openwaSessionId}
                                                onChange={(e) => setConfig({ ...config, openwaSessionId: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-xs">
                                        <label className="font-bold text-slate-600 block mb-1">Model AI (Gemini)</label>
                                        <select
                                            value={config.modelName}
                                            onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                                        >
                                            {!GEMINI_MODEL_OPTIONS.some((m) => m.value === config.modelName) && config.modelName && (
                                                <option value={config.modelName}>{config.modelName}</option>
                                            )}
                                            {GEMINI_MODEL_OPTIONS.map((m) => (
                                                <option key={m.value} value={m.value}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={config.allowGroups}
                                                onChange={(e) => setConfig({ ...config, allowGroups: e.target.checked })}
                                                className="rounded border-slate-300"
                                            />
                                            Izinkan di Grup WA (pakai prefix)
                                        </label>
                                        <input
                                            type="text"
                                            value={config.groupPrefix}
                                            onChange={(e) => setConfig({ ...config, groupPrefix: e.target.value })}
                                            placeholder="/cce"
                                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs text-center"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => saveConfig(config)}
                                        disabled={savingConfig}
                                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                                    >
                                        {savingConfig ? 'Menyimpan...' : 'Simpan Pengaturan'}
                                    </button>
                                </div>

                                {/* Whitelist Users */}
                                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="font-black text-slate-900 text-base">Daftar Nomor WA Karyawan</h2>
                                        <span className="text-[11px] font-bold text-slate-400">Whitelist</span>
                                    </div>

                                    <form onSubmit={handleAddWhitelistUser} className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                placeholder="No. WA (0812xxx)"
                                                value={newPhone}
                                                onChange={(e) => setNewPhone(e.target.value)}
                                                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Nama Staf / Bos"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                value={newRole}
                                                onChange={(e) => setNewRole(e.target.value as WaAgentRole)}
                                                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                                            >
                                                <option value="owner">Owner (Full Akses + Invoice)</option>
                                                <option value="admin">Administrator (Full Akses + Invoice)</option>
                                                <option value="pengurus">Pengurus (Baca Laporan + Input STT)</option>
                                                <option value="helper">Helper (Hanya Cek Resi)</option>
                                            </select>
                                            <button
                                                type="submit"
                                                disabled={addingUser}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                                            >
                                                <UserPlus size={14} /> Tambah
                                            </button>
                                        </div>
                                    </form>

                                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                        {waUsers.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-6">
                                                Belum ada nomor terdaftar. Tambahkan nomor Owner &amp; Admin agar bisa chat AI lewat WhatsApp.
                                            </p>
                                        ) : (
                                            waUsers.map((item) => (
                                                <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                                {ROLE_LABELS[item.role] || item.role}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] font-mono text-slate-500">{item.phone}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleUserActive(item)}
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                                item.active
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}
                                                        >
                                                            {item.active ? 'Aktif' : 'Nonaktif'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteUser(item)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Live AI Simulator */}
                            <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden h-[660px]">
                                <div className="px-5 py-3.5 bg-emerald-700 text-white flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <Bot size={20} />
                                        <div>
                                            <h2 className="font-extrabold text-sm">Simulator Karyawan AI WhatsApp</h2>
                                            <p className="text-[11px] text-emerald-100">
                                                Terhubung langsung ke Firestore CCE &amp; {config.modelName}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-emerald-100 font-semibold">Simulasi Role:</span>
                                        <select
                                            value={simRole}
                                            onChange={(e) => setSimRole(e.target.value as WaAgentRole)}
                                            className="bg-emerald-800 text-white border border-emerald-500/40 rounded-lg px-2.5 py-1 font-bold text-xs outline-none"
                                        >
                                            <option value="owner">Owner</option>
                                            <option value="admin">Admin</option>
                                            <option value="pengurus">Pengurus</option>
                                            <option value="helper">Helper</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Quick Prompts */}
                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto">
                                    {QUICK_PROMPTS.map((q) => (
                                        <button
                                            key={q}
                                            type="button"
                                            onClick={() => setSimInput(q)}
                                            className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap shrink-0"
                                        >
                                            {q.length > 42 ? `${q.slice(0, 42)}...` : q}
                                        </button>
                                    ))}
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]">
                                    {simMessages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs whitespace-pre-wrap leading-relaxed ${
                                                    msg.sender === 'user'
                                                        ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs'
                                                        : 'bg-white text-slate-800 rounded-tl-xs'
                                                }`}
                                            >
                                                {msg.imagePreview && (
                                                    <a
                                                        href={msg.imagePreview}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Klik untuk perbesar gambar"
                                                    >
                                                        <img
                                                            src={msg.imagePreview}
                                                            alt="Lampiran"
                                                            className="max-h-72 rounded-lg mb-2 object-contain border border-slate-200 bg-white"
                                                        />
                                                    </a>
                                                )}
                                                <p>{msg.text}</p>
                                                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                                                        {msg.toolsUsed.map((tool, idx) => (
                                                            <span
                                                                key={`${tool}-${idx}`}
                                                                className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                                                            >
                                                                {tool}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {simSending && (
                                        <div className="flex justify-start">
                                            <div className="bg-white rounded-2xl px-4 py-2.5 text-xs text-slate-500 shadow-xs">
                                                AI sedang mengetik / memanggil data CCE...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Pending Confirmation Quick Action Bar */}
                                {simPending && (
                                    <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between gap-2 text-xs">
                                        <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                            <CheckCircle2 size={14} className="text-amber-600" />
                                            Menunggu konfirmasi draft (
                                            {simPending.type === 'create_stt'
                                                ? 'Buat STT'
                                                : simPending.type === 'batch_update_stt_pricing'
                                                  ? 'Update Harga & Status STT'
                                                  : simPending.type === 'create_voyage'
                                                    ? 'Buat Pemberangkatan'
                                                    : simPending.type === 'save_voyage_expenses'
                                                      ? 'Biaya Pemberangkatan'
                                                      : simPending.type === 'assign_stts_to_voyage'
                                                        ? 'Masukkan STT ke Kapal'
                                                        : 'Buat Invoice'}
                                            )
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={simSending}
                                                onClick={() => sendSimulatorMessage('YA')}
                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg"
                                            >
                                                YA (Simpan)
                                            </button>
                                            <button
                                                type="button"
                                                disabled={simSending}
                                                onClick={() => sendSimulatorMessage('BATAL')}
                                                className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg"
                                            >
                                                BATAL
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Image preview bar before sending */}
                                {simMedia && (
                                    <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <img src={simMedia.previewUrl} alt="Preview" className="h-10 w-10 object-cover rounded border" />
                                            <span className="font-semibold text-slate-700">Foto nota/lampiran siap dikirim</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSimMedia(null)}
                                            className="p-1 text-slate-500 hover:text-red-600"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                {/* Input Bar */}
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        sendSimulatorMessage();
                                    }}
                                    className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2"
                                >
                                    <label
                                        className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-600 cursor-pointer shrink-0"
                                        title="Lampirkan foto nota / resi"
                                    >
                                        <ImagePlus size={18} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleSelectSimImage} />
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ketik perintah seperti chat WhatsApp..."
                                        value={simInput}
                                        onChange={(e) => setSimInput(e.target.value)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={simSending || (!simInput.trim() && !simMedia)}
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Send size={15} /> Kirim
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Audit Logs */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity size={18} className="text-blue-600" />
                                    <h2 className="font-black text-slate-900 text-base">Riwayat Aktivitas &amp; Audit AI (30 Terbaru)</h2>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                        <tr>
                                            <th className="px-4 py-3">Waktu</th>
                                            <th className="px-4 py-3">Sumber / User</th>
                                            <th className="px-4 py-3">Pesan Masuk</th>
                                            <th className="px-4 py-3">Tools</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Balasan AI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                    Belum ada aktivitas AI Agent tercatat.
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50/60 align-top">
                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                                        {log.createdAt.toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 mr-1.5">
                                                            {log.source}
                                                        </span>
                                                        <span className="font-bold text-slate-800">{log.userName || '-'}</span>
                                                        <div className="font-mono text-[10px] text-slate-400">{log.phone}</div>
                                                    </td>
                                                    <td className="px-4 py-3 max-w-[220px] truncate text-slate-700" title={log.incomingText}>
                                                        {log.incomingText}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                                                            {log.toolsUsed.map((t, i) => (
                                                                <span key={`${t}-${i}`} className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                log.status === 'ok'
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : log.status === 'blocked'
                                                                      ? 'bg-amber-50 text-amber-700'
                                                                      : 'bg-red-50 text-red-700'
                                                            }`}
                                                        >
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 max-w-[280px] truncate text-slate-600" title={log.replyText}>
                                                        {log.replyText}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}

