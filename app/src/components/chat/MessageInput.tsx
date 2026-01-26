'use client';

import { useState } from 'react';
import { useChatUI } from '@/contexts/ChatUIContext';

interface MessageInputProps {
    onSend?: (message: string) => void;
    isLoading?: boolean;
}

export function MessageInput({ onSend, isLoading = false }: MessageInputProps) {
    const { setTypingMode } = useChatUI();
    const [message, setMessage] = useState('');

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!message.trim() || isLoading) return;

        if (onSend) {
            onSend(message);
        }
        setMessage('');

    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                width: '100%',
                padding: '16px',
                background: '#E9E1D4',
                borderTop: '1px solid #D8CFC1',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end',
            }}
        >
            <div style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
            }}>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setTypingMode(true)}
                    onBlur={() => {
                        // Small timeout to allow click on "Send" button before blur hides FAB
                        setTimeout(() => setTypingMode(false), 200);
                    }}
                    placeholder={isLoading ? "Thinking..." : "Message..."}
                    rows={1}
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingRight: '40px',
                        background: '#F6F1E8',
                        border: '1px solid #D8CFC1',
                        borderRadius: '24px',
                        color: '#2F2A24',
                        fontSize: '16px',
                        resize: 'none',
                        outline: 'none',
                        minHeight: '44px',
                        maxHeight: '120px',
                        lineHeight: '20px',
                    }}
                />
            </div>

            <button
                type="submit"
                disabled={!message.trim() || isLoading}
                style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: !message.trim() || isLoading ? '#D8CFC1' : '#B9A27A',
                    color: !message.trim() || isLoading ? '#8A7E72' : '#2F2A24',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: !message.trim() || isLoading ? 'default' : 'pointer',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                }}
            >
                {/* SVG Arrow */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </form>
    );
}

