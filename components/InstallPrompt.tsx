'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already running as PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Listen for beforeinstallprompt event
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setShowPrompt(false);
            console.log('PWA installed successfully!');
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show install prompt
        deferredPrompt.prompt();

        // Wait for user choice
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User ${outcome} the install prompt`);

        // Clear prompt
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Store dismissal in localStorage to not show again for 7 days
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    };

    // Don't show if already installed or dismissed recently
    useEffect(() => {
        const dismissed = localStorage.getItem('pwa-prompt-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed);
            const weekInMs = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - dismissedTime < weekInMs) {
                setShowPrompt(false);
            }
        }
    }, []);

    if (isInstalled || !showPrompt || !deferredPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border-2 border-blue-200">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Dismiss"
                >
                    <X size={20} />
                </button>

                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Download className="text-white" size={24} />
                    </div>

                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">
                            Install C2-MS App
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Install aplikasi untuk akses lebih cepat dan bisa digunakan offline
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={handleInstall}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition-all duration-300"
                            >
                                Install Sekarang
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            >
                                Nanti
                            </button>
                        </div>
                    </div>
                </div>

                {/* Benefits */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-2xl mb-1">⚡</div>
                            <div className="text-xs text-gray-600">Lebih Cepat</div>
                        </div>
                        <div>
                            <div className="text-2xl mb-1">📱</div>
                            <div className="text-xs text-gray-600">Home Screen</div>
                        </div>
                        <div>
                            <div className="text-2xl mb-1">🔌</div>
                            <div className="text-xs text-gray-600">Offline Mode</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
