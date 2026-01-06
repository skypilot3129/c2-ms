import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
    title: "C2-MS | Cahaya Cargo Express",
    description: "Sistem Manajemen Logistik Cahaya Cargo Express",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "C2-MS",
    },
    applicationName: "C2-MS",
    keywords: ["logistics", "cargo", "management", "cahaya cargo express"],
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: "#3b82f6",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="id">
            <head>
                <link rel="icon" href="/icon-192.png" />
                <link rel="apple-touch-icon" href="/icon-192.png" />
                <meta name="theme-color" content="#3b82f6" />
            </head>
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>

                {/* PWA Service Worker Registration */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                window.addEventListener('load', function() {
                                    navigator.serviceWorker.register('/sw.js')
                                        .then(function(registration) {
                                            console.log('[PWA] Service Worker registered:', registration.scope);
                                        })
                                        .catch(function(error) {
                                            console.log('[PWA] Service Worker registration failed:', error);
                                        });
                                });
                            }
                        `,
                    }}
                />
            </body>
        </html>
    );
}
