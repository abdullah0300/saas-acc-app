// src/components/AI/ChatbotPopup.tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Sparkles } from 'lucide-react';

export function ChatbotPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const sendAuthToIframe = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'AUTH_SESSION', session },
                    'https://chat-smartcfo.webcraftio.com' // Production
                    // Use 'http://localhost:3000' for local testing
                );
                console.log('🔐 Auth session sent to chatbot iframe');
            }
        };

        // Send after iframe loads
        const iframe = iframeRef.current;
        if (iframe) {
            iframe.onload = sendAuthToIframe;
        }

        // Also listen for session requests from iframe
        const handleMessage = async (event: MessageEvent) => {
            // Validate origin
            if (event.origin !== 'https://chat-smartcfo.webcraftio.com' &&
                event.origin !== 'http://localhost:3000') {
                return;
            }

            if (event.data?.type === 'REQUEST_AUTH_SESSION') {
                console.log('📨 Chatbot requested auth session');
                sendAuthToIframe();
            }
        };
        window.addEventListener('message', handleMessage);

        return () => window.removeEventListener('message', handleMessage);
    }, [isOpen]);

    return (
        <>
            {/* Floating Button - Exact old chatbot design */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-2 cursor-pointer z-[1000] transition-all duration-500 ease-out hover:scale-105"
                aria-label="Open AI Chat"
            >
                <div
                    className="relative rounded-2xl px-2 py-3"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 50%, rgba(241, 245, 249, 0.98) 100%)',
                        backdropFilter: 'blur(40px) saturate(200%)',
                        border: '1.5px solid rgba(203, 213, 225, 0.5)',
                        boxShadow: 'rgba(139, 92, 246, 0.6) 0px 10px 30px, rgba(139, 92, 246, 0.35) 0px 0px 50px, rgba(255, 255, 255, 0.8) 0px 1px 0px inset',
                    }}
                >
                    <div className="flex flex-col items-center gap-2">
                        {/* Logo container */}
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(to right bottom, rgb(59, 130, 246), rgb(147, 51, 234))',
                                boxShadow: 'rgba(59, 130, 246, 0.3) 0px 4px 12px',
                            }}
                        >
                            <img
                                alt="SmartCFO"
                                className="w-full h-full object-contain p-1.5"
                                src="/smartcfo logo bg.png"
                            />
                        </div>

                        {/* Sparkles icon */}
                        <Sparkles className="h-4 w-4 text-purple-500" />
                    </div>
                </div>
            </button>

            {/* Modal */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001,
                    }}
                    onClick={(e) => {
                        // Close modal when clicking backdrop
                        if (e.target === e.currentTarget) {
                            setIsOpen(false);
                        }
                    }}
                >
                    <div style={{
                        width: '900px',
                        height: '800px',
                        maxWidth: '95vw',
                        maxHeight: '90vh',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    }}>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                zIndex: 10,
                                background: 'rgba(0,0,0,0.1)',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                            }}
                            aria-label="Close chat"
                        >
                            ✕
                        </button>
                        <iframe
                            ref={iframeRef}
                            src="https://chat-smartcfo.webcraftio.com"
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="microphone"
                            title="SmartCFO AI Chat"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
