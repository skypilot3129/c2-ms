'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const { register, user } = useAuth();

    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if already logged in (in useEffect to avoid setState during render)
    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const validateForm = (): boolean => {
        if (!formData.displayName.trim()) {
            setError('Nama lengkap harus diisi');
            return false;
        }

        if (!formData.email) {
            setError('Email harus diisi');
            return false;
        }

        if (!formData.email.includes('@')) {
            setError('Format email tidak valid');
            return false;
        }

        if (formData.password.length < 6) {
            setError('Password minimal 6 karakter');
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Password dan konfirmasi password tidak sama');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            await register(formData.email, formData.password, formData.displayName);
            router.push('/');
        } catch (err: any) {
            console.error('Register error:', err);

            // Firebase error messages translation
            if (err.code === 'auth/email-already-in-use') {
                setError('Email sudah terdaftar. Silakan login.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Format email tidak valid');
            } else if (err.code === 'auth/weak-password') {
                setError('Password terlalu lemah. Minimal 6 karakter.');
            } else {
                setError('Gagal mendaftar. Silakan coba lagi.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Password strength indicator
    const getPasswordStrength = () => {
        const len = formData.password.length;
        if (len === 0) return { text: '', color: '' };
        if (len < 6) return { text: 'Lemah', color: 'text-red-600' };
        if (len < 10) return { text: 'Sedang', color: 'text-yellow-600' };
        return { text: 'Kuat', color: 'text-green-600' };
    };

    const strength = getPasswordStrength();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl mb-4">
                        <UserPlus size={48} />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Daftar Akun Baru</h1>
                    <p className="text-gray-600">Bergabung dengan C2-MS</p>
                </div>

                {/* Register Form */}
                <div className="bg-white rounded-2xl p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Display Name Field */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                <User size={18} className="text-blue-600" />
                                Nama Lengkap <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => handleChange('displayName', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-gray-800"
                                placeholder="Nama Anda"
                                disabled={loading}
                            />
                        </div>

                        {/* Email Field */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                <Mail size={18} className="text-blue-600" />
                                Email <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-gray-800"
                                placeholder="nama@email.com"
                                disabled={loading}
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                <Lock size={18} className="text-blue-600" />
                                Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-gray-800"
                                placeholder="Minimal 6 karakter"
                                disabled={loading}
                            />
                            {strength.text && (
                                <p className={`text-sm mt-1 ${strength.color} font-medium`}>
                                    {strength.text}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle size={18} className="text-blue-600" />
                                Konfirmasi Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-gray-800"
                                placeholder="Ulangi password"
                                disabled={loading}
                            />
                        </div>

                        {/* Register Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Mendaftar...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    Daftar Sekarang
                                </>
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            Sudah punya akun?{' '}
                            <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                                Login Sekarang
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-gray-600 hover:text-gray-800 transition-colors">
                        ← Kembali ke Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
