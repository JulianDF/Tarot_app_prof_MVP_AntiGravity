'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '@/hooks/useChat';

interface ChatPanelProps {
    messages: Message[];
    isLoading: boolean;
}

export function ChatPanel({ messages, isLoading }: ChatPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [isUserAtBottom, setIsUserAtBottom] = useState(true);
    const prevMessageCountRef = useRef(messages.length);

    // Check if user is near bottom of scroll
    const checkIfAtBottom = useCallback(() => {
        const container = containerRef.current;
        if (!container) return true;

        const threshold = 100; // px from bottom
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        setIsUserAtBottom(isAtBottom);
    }, []);

    // Handle scroll events
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', checkIfAtBottom);
        return () => container.removeEventListener('scroll', checkIfAtBottom);
    }, [checkIfAtBottom]);

    // Only auto-scroll when a NEW message is added (not token updates) AND user is at bottom
    useEffect(() => {
        const newMessageAdded = messages.length > prevMessageCountRef.current;
        prevMessageCountRef.current = messages.length;

        // Only scroll if: new message added AND user was at bottom
        if (newMessageAdded && isUserAtBottom) {
            const container = containerRef.current;
            if (container) {
                // Use scrollTo instead of scrollIntoView to prevent parent scroll
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }
    }, [messages.length, isUserAtBottom]);

    return (
        <div ref={containerRef} style={styles.container}>
            {messages.length === 0 ? (
                <div style={styles.placeholder}>
                    <p>✨ The cards await you</p>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '8px' }}>
                        Ask a question to begin your reading.
                    </p>
                </div>
            ) : (
                <div style={styles.list}>
                    {messages.map((msg) => (
                        <div key={msg.id} style={{
                            ...styles.messageRow,
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}>
                            {/* System Message (Center bubble) */}
                            {msg.role === 'system' ? (
                                <div style={styles.systemMessage}>
                                    {msg.content}
                                </div>
                            ) : (
                                /* Normal Message with Markdown rendering */
                                <div style={{
                                    ...styles.bubble,
                                    ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
                                }}>
                                    <div className="markdown-content" style={styles.content}>
                                        {msg.content ? (
                                            <ReactMarkdown
                                                components={{
                                                    // Custom component styling
                                                    h1: ({ children }) => <h1 style={markdownStyles.h1}>{children}</h1>,
                                                    h2: ({ children }) => <h2 style={markdownStyles.h2}>{children}</h2>,
                                                    h3: ({ children }) => <h3 style={markdownStyles.h3}>{children}</h3>,
                                                    h4: ({ children }) => <h4 style={markdownStyles.h4}>{children}</h4>,
                                                    p: ({ children }) => <p style={markdownStyles.p}>{children}</p>,
                                                    strong: ({ children }) => <strong style={markdownStyles.strong}>{children}</strong>,
                                                    em: ({ children }) => <em style={markdownStyles.em}>{children}</em>,
                                                    ul: ({ children }) => <ul style={markdownStyles.ul}>{children}</ul>,
                                                    ol: ({ children }) => <ol style={markdownStyles.ol}>{children}</ol>,
                                                    li: ({ children }) => <li style={markdownStyles.li}>{children}</li>,
                                                    hr: () => <hr style={markdownStyles.hr} />,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        ) : (
                                            <span style={styles.typingIndicator}>Thinking...</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading Indicator (if no empty assistant message is pending) */}
                    {isLoading && messages[messages.length - 1]?.role === 'user' && (
                        <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
                            <div style={{ ...styles.bubble, ...styles.assistantBubble }}>
                                <span style={styles.typingIndicator}>Connecting...</span>
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} style={{ height: '1px' }} />
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
    },
    list: {
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: 'min-content', // allow scrolling
    },
    placeholder: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        padding: '20px',
        textAlign: 'center',
    },
    messageRow: {
        display: 'flex',
        width: '100%',
    },
    bubble: {
        maxWidth: '85%',
        padding: '12px 16px',
        borderRadius: '16px',
        fontSize: '16px',
        lineHeight: '1.5',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        wordWrap: 'break-word',
    },
    userBubble: {
        backgroundColor: '#6d28d9',
        color: 'white',
        borderBottomRightRadius: '4px',
    },
    assistantBubble: {
        backgroundColor: '#1f1f2e',
        color: '#e0e0e0',
        borderBottomLeftRadius: '4px',
        border: '1px solid #2a2a3a',
    },
    systemMessage: {
        margin: '8px auto',
        padding: '8px 16px',
        backgroundColor: 'rgba(109, 40, 217, 0.2)',
        color: '#d4b7fa',
        fontSize: '0.85rem',
        borderRadius: '12px',
        textAlign: 'center',
        maxWidth: '90%',
        whiteSpace: 'pre-wrap',
        border: '1px solid rgba(109, 40, 217, 0.3)',
    },
    content: {
        // Remove pre-wrap since markdown handles formatting
    },
    typingIndicator: {
        opacity: 0.6,
        fontStyle: 'italic',
        fontSize: '0.9rem',
    }
};

// Markdown-specific styles
const markdownStyles: Record<string, React.CSSProperties> = {
    h1: {
        fontSize: '1.5rem',
        fontWeight: 700,
        marginTop: '16px',
        marginBottom: '8px',
        color: '#f0e6ff',
    },
    h2: {
        fontSize: '1.3rem',
        fontWeight: 600,
        marginTop: '14px',
        marginBottom: '6px',
        color: '#e8d5ff',
    },
    h3: {
        fontSize: '1.1rem',
        fontWeight: 600,
        marginTop: '12px',
        marginBottom: '4px',
        color: '#d4b7fa',
    },
    h4: {
        fontSize: '1rem',
        fontWeight: 600,
        marginTop: '10px',
        marginBottom: '4px',
        color: '#c9a8f5',
    },
    p: {
        marginTop: '8px',
        marginBottom: '8px',
        lineHeight: 1.6,
    },
    strong: {
        fontWeight: 600,
        color: '#f0e6ff',
    },
    em: {
        fontStyle: 'italic',
        color: '#c9a8f5',
    },
    ul: {
        marginTop: '8px',
        marginBottom: '8px',
        paddingLeft: '20px',
    },
    ol: {
        marginTop: '8px',
        marginBottom: '8px',
        paddingLeft: '20px',
    },
    li: {
        marginBottom: '4px',
        lineHeight: 1.5,
    },
    hr: {
        border: 'none',
        borderTop: '1px solid rgba(109, 40, 217, 0.3)',
        margin: '16px 0',
    },
};
