'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import { chatWithGemini, type ChatMessage } from '@/app/actions/chat';
import ReactMarkdown from 'react-markdown';

export default function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', parts: 'Halo! Saya Agent Cahaya. Ada yang bisa saya bantu untuk bisnis Cahaya Cargo Express hari ini?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message immediately
        const newHistory = [
            ...messages,
            { role: 'user' as const, parts: userMessage }
        ];
        setMessages(newHistory);
        setIsLoading(true);

        try {
            // Call Server Action
            const result = await chatWithGemini(newHistory, userMessage);

            if (result.error) {
                setMessages(prev => [...prev, { role: 'model', parts: `⚠️ ${result.error}` }]);
            } else if (result.text) {
                setMessages(prev => [...prev, { role: 'model', parts: result.text }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', parts: 'Maaf, terjadi kesalahan koneksi.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Minimized View
    if (isOpen && isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg flex items-center gap-2 transition-all"
                >
                    <div className="relative">
                        <Bot size={24} />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-600"></div>
                    </div>
                    <span className="font-semibold pr-2">Agent Cahaya</span>
                </button>
            </div>
        );
    }

    // Chat Window
    if (isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 w-full max-w-[400px] h-[600px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-blue-100 animate-in slide-in-from-bottom-5 overflow-hidden font-sans">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shrink-0 flex items-center justify-between text-white shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Bot size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight flex items-center gap-1">
                                Agent Cahaya <Sparkles size={14} className="text-yellow-300" />
                            </h3>
                            <p className="text-xs text-blue-100 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Online • AI Assistant
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/90"
                            title="Minimize"
                        >
                            <Minimize2 size={18} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/90"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scroll-smooth">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2 items-end`}>
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-600 text-white shadow-sm'
                                    }`}>
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={16} />}
                                </div>

                                {/* Bubble */}
                                <div className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                    }`}>
                                    {msg.role === 'model' ? (
                                        <div className="markdown prose prose-sm max-w-none prose-p:my-1 prose-pre:bg-gray-800 prose-pre:text-white prose-a:text-blue-600">
                                            <ReactMarkdown>{msg.parts}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p>{msg.parts}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Loading Indicator */}
                    {isLoading && (
                        <div className="flex justify-start w-full">
                            <div className="flex flex-row gap-2 items-end">
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-bl-none shadow-sm">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></div>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-300"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Tanya sesuatu tentang bisnis..."
                            className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 transition-shadow focus:shadow-sm outline-none"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow active:scale-95"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-gray-400 mt-2">
                        Agent Cahaya dapat membuat kesalahan. Mohon verifikasi informasi penting.
                    </p>
                </div>
            </div>
        );
    }

    // Closed State (Floating Button)
    return (
        <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110 active:scale-95 group animate-in zoom-in duration-300"
        >
            <div className="relative">
                <Bot size={28} />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-[3px] border-blue-600"></div>
            </div>
            {/* Tooltip */}
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Chat dengan Agent Cahaya
                <div className="absolute top-1/2 left-full -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
            </span>
        </button>
    );
}
