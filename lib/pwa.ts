// PWA utility functions

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            console.log('[PWA] Service Worker registered:', registration);

            // Check for updates on page load
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[PWA] New service worker found');

                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] New service worker installed, update available');
                        // Notify user about update
                        if (confirm('Aplikasi telah diupdate. Reload untuk mendapatkan versi terbaru?')) {
                            newWorker.postMessage('SKIP_WAITING');
                            window.location.reload();
                        }
                    }
                });
            });

            return registration;
        } catch (error) {
            console.error('[PWA] Service Worker registration failed:', error);
            return null;
        }
    }
    return null;
};

// Check if app is running as PWA
export const isPWA = (): boolean => {
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
};

// Check if service worker is supported
export const isServiceWorkerSupported = (): boolean => {
    return 'serviceWorker' in navigator;
};

// Unregister service worker (for development/testing)
export const unregisterServiceWorker = async (): Promise<boolean> => {
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            return await registration.unregister();
        }
    }
    return false;
};
