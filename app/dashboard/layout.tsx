import AIChatWidget from '@/components/AIChatWidget';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <section>
            {children}
            <AIChatWidget />
        </section>
    );
}
