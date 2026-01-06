'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { login, user } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if already logged in (in useEffect to avoid setState during render)
    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Email dan password harus diisi');
            return;
        }

        setLoading(true);
        try {
            await login(email, password);
            router.push('/');
        } catch (err: any) {
            console.error('Login error:', err);

            // Firebase error messages translation
            if (err.code === 'auth/user-not-found') {
                setError('Email tidak terdaftar');
            } else if (err.code === 'auth/wrong-password') {
                setError('Password salah');
            } else if (err.code === 'auth/invalid-email') {
                setError('Format email tidak valid');
            } else if (err.code === 'auth/invalid-credential') {
                setError('Email atau password salah');
            } else {
                setError('Gagal login. Silakan coba lagi.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl mb-4">
                        <LogIn size={48} />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Selamat Datang</h1>
                    <p className="text-gray-600">Login ke C2-MS Dashboard</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-2xl p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Email Field */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                <Mail size={18} className="text-blue-600" />
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-gray-800"
                                placeholder="nama@email.com"
                                disabled={loading}
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                <Lock size={18} className="text-blue-600" />
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all text-gray-800"
                                placeholder="Masukkan password"
                                disabled={loading}
                            />
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    Login
                                </>
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            Belum punya akun?{' '}
                            <Link href="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                                Daftar Sekarang
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
