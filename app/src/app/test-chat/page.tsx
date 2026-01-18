'use client';

/**
 * Test Chat Page
 * 
 * Simple interface for testing the chat API during Phase 1 development.
 * Located at /test-chat
 */

import { useState, useRef, useEffect } from 'react';
import { ChatStreamEvent, SpreadWithCards, SpreadLedgerEntry, Reading } from '@/types';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: Array<{ id: string; name: string; arguments: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
}

export default function TestChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeSpread, setActiveSpread] = useState<SpreadWithCards | undefined>();
    const [spreadLedger, setSpreadLedger] = useState<SpreadLedgerEntry[]>([]);
    const [debugEvents, setDebugEvents] = useState<ChatStreamEvent[]>([]);
    const [showDebug, setShowDebug] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Clear session and start fresh
    const clearSession = () => {
        setMessages([]);
        setInput('');
        setActiveSpread(undefined);
        setSpreadLedger([]);
        setDebugEvents([]);
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setDebugEvents([]);

        // Prepare messages for API (only user/assistant content)
        const apiMessages = [...messages, userMessage]
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    activeSpread,
                    spreadLedger,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Create assistant message placeholder
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: '',
                toolCalls: [],
                toolResults: [],
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Process SSE stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response body');

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const event = JSON.parse(line.slice(6)) as ChatStreamEvent;
                        setDebugEvents(prev => [...prev, event]);

                        switch (event.type) {
                            case 'text':
                                setMessages(prev => {
                                    const updated = [...prev];
                                    // Find the last assistant message (may not be the last message due to system messages)
                                    const lastAssistantIndex = updated.findLastIndex(m => m.role === 'assistant');
                                    if (lastAssistantIndex !== -1) {
                                        const last = updated[lastAssistantIndex];
                                        updated[lastAssistantIndex] = {
                                            ...last,
                                            content: last.content + event.content,
                                        };
                                    }
                                    return updated;
                                });
                                break;

                            case 'tool_call':
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const lastAssistantIndex = updated.findLastIndex(m => m.role === 'assistant');
                                    if (lastAssistantIndex !== -1) {
                                        const last = updated[lastAssistantIndex];
                                        updated[lastAssistantIndex] = {
                                            ...last,
                                            toolCalls: [
                                                ...(last.toolCalls || []),
                                                { id: event.id, name: event.name, arguments: event.arguments },
                                            ],
                                        };
                                    }
                                    return updated;
                                });
                                break;

                            case 'tool_result':
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const lastAssistantIndex = updated.findLastIndex(m => m.role === 'assistant');
                                    if (lastAssistantIndex !== -1) {
                                        const last = updated[lastAssistantIndex];
                                        updated[lastAssistantIndex] = {
                                            ...last,
                                            toolResults: [
                                                ...(last.toolResults || []),
                                                { name: event.name, result: event.result },
                                            ],
                                        };
                                    }
                                    return updated;
                                });
                                break;

                            case 'spread_laid':
                                // Update active spread - add as system message with card details
                                const reading = event.reading as Reading;
                                // Use spreadWithCards if available for card names, otherwise fall back to card_id
                                const spreadWithCards = (event as { spreadWithCards?: SpreadWithCards }).spreadWithCards;

                                const cardsList = spreadWithCards
                                    ? spreadWithCards.cards.map((cardData, idx) => {
                                        const position = spreadWithCards.spread.positions[idx];
                                        const orientation = cardData.reversed ? ' (Reversed)' : '';
                                        return `  ${idx + 1}. **${cardData.card.name}**${orientation}\n     → ${position?.meaning || 'Position ' + (idx + 1)}`;
                                    }).join('\n')
                                    : reading.cards.map((card, idx) => {
                                        const position = reading.spread_snapshot.positions[idx];
                                        const orientation = card.reversed ? '(R)' : '';
                                        return `  ${idx + 1}. Card #${card.card_id} ${orientation} → ${position?.meaning || 'Position ' + (idx + 1)}`;
                                    }).join('\n');

                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated.push({
                                        id: crypto.randomUUID(),
                                        role: 'system',
                                        content: `📊 **Spread laid:** ${reading.spread_snapshot.name}\n**Question:** "${reading.question}"\n\n**Cards drawn:**\n${cardsList}`,
                                    });
                                    return updated;
                                });
                                break;

                            case 'error':
                                console.error('Stream error:', event.message);
                                break;
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE event:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🔮 Tarot Chat — Test Interface</h1>
                <p style={styles.subtitle}>Phase 1: Proving the AI Flow</p>
                <button
                    onClick={clearSession}
                    style={styles.newSessionButton}
                >
                    🔄 New Session
                </button>
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    style={styles.debugToggle}
                >
                    {showDebug ? 'Hide' : 'Show'} Debug
                </button>
            </header>

            <div style={styles.mainContent}>
                <div style={styles.chatPanel}>
                    <div style={styles.messagesContainer}>
                        {messages.length === 0 && (
                            <div style={styles.placeholder}>
                                <p>Try asking about:</p>
                                <ul style={styles.suggestions}>
                                    <li>"Tell me about The Fool card"</li>
                                    <li>"I need guidance on a career decision"</li>
                                    <li>"Can you do a reading about my relationship?"</li>
                                </ul>
                            </div>
                        )}

                        {messages.map(message => (
                            <div
                                key={message.id}
                                style={{
                                    ...styles.message,
                                    ...(message.role === 'user' ? styles.userMessage :
                                        message.role === 'system' ? styles.systemMessage :
                                            styles.assistantMessage),
                                }}
                            >
                                <div style={styles.messageRole}>
                                    {message.role === 'user' ? '👤 You' :
                                        message.role === 'system' ? '⚙️ System' : '🔮 Reader'}
                                </div>
                                <div style={styles.messageContent}>
                                    {message.content || <em style={{ opacity: 0.5 }}>Thinking...</em>}
                                </div>

                                {message.toolCalls && message.toolCalls.length > 0 && (
                                    <div style={styles.toolCalls}>
                                        <strong>Tool Calls:</strong>
                                        {message.toolCalls.map((tc, i) => (
                                            <div key={i} style={styles.toolCall}>
                                                <code>{tc.name}</code>
                                                <pre style={styles.toolArgs}>
                                                    {JSON.stringify(tc.arguments, null, 2)}
                                                </pre>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSubmit} style={styles.inputForm}>
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Ask about tarot cards or request a reading..."
                            style={styles.textarea}
                            disabled={isLoading}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <button
                            type="submit"
                            style={styles.submitButton}
                            disabled={isLoading || !input.trim()}
                        >
                            {isLoading ? 'Reading...' : 'Send'}
                        </button>
                    </form>
                </div>

                {showDebug && (
                    <div style={styles.debugPanel}>
                        <h3 style={styles.debugTitle}>Debug Events</h3>
                        <div style={styles.debugEvents}>
                            {debugEvents.map((event, i) => (
                                <div key={i} style={styles.debugEvent}>
                                    <span style={styles.debugEventType}>{event.type}</span>
                                    <pre style={styles.debugEventContent}>
                                        {JSON.stringify(event, null, 2).slice(0, 500)}
                                        {JSON.stringify(event).length > 500 ? '...' : ''}
                                    </pre>
                                </div>
                            ))}
                        </div>

                        {activeSpread && (
                            <div style={styles.debugSection}>
                                <h4>Active Spread</h4>
                                <pre style={styles.debugContent}>
                                    {JSON.stringify(activeSpread, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#0f0f1a',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
        padding: '1rem 2rem',
        borderBottom: '1px solid #2a2a3a',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    title: {
        margin: 0,
        fontSize: '1.5rem',
        background: 'linear-gradient(135deg, #9b59b6, #3498db)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        margin: 0,
        color: '#888',
        fontSize: '0.9rem',
    },
    debugToggle: {
        marginLeft: 'auto',
        padding: '0.5rem 1rem',
        background: '#2a2a3a',
        border: 'none',
        borderRadius: '4px',
        color: '#aaa',
        cursor: 'pointer',
    },
    newSessionButton: {
        padding: '0.5rem 1rem',
        background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
    },
    mainContent: {
        display: 'flex',
        height: 'calc(100vh - 80px)',
    },
    chatPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #2a2a3a',
    },
    messagesContainer: {
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
    },
    placeholder: {
        textAlign: 'center',
        color: '#666',
        marginTop: '2rem',
    },
    suggestions: {
        listStyle: 'none',
        padding: 0,
        marginTop: '1rem',
    },
    message: {
        marginBottom: '1rem',
        padding: '1rem',
        borderRadius: '8px',
    },
    userMessage: {
        backgroundColor: '#1a1a2e',
        marginLeft: '2rem',
    },
    assistantMessage: {
        backgroundColor: '#16213e',
        marginRight: '2rem',
    },
    systemMessage: {
        backgroundColor: '#1e1e2e',
        borderLeft: '3px solid #9b59b6',
        fontSize: '0.9rem',
    },
    messageRole: {
        fontSize: '0.8rem',
        color: '#888',
        marginBottom: '0.5rem',
    },
    messageContent: {
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
    },
    toolCalls: {
        marginTop: '1rem',
        padding: '0.5rem',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '4px',
        fontSize: '0.85rem',
    },
    toolCall: {
        marginTop: '0.5rem',
    },
    toolArgs: {
        margin: '0.25rem 0',
        padding: '0.5rem',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '4px',
        fontSize: '0.75rem',
        overflow: 'auto',
    },
    inputForm: {
        display: 'flex',
        gap: '0.5rem',
        padding: '1rem',
        borderTop: '1px solid #2a2a3a',
    },
    textarea: {
        flex: 1,
        padding: '0.75rem',
        backgroundColor: '#1a1a2e',
        border: '1px solid #2a2a3a',
        borderRadius: '8px',
        color: '#e0e0e0',
        fontSize: '1rem',
        resize: 'none',
        minHeight: '60px',
    },
    submitButton: {
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #9b59b6, #3498db)',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
    },
    debugPanel: {
        width: '400px',
        backgroundColor: '#0a0a12',
        padding: '1rem',
        overflowY: 'auto',
    },
    debugTitle: {
        margin: '0 0 1rem 0',
        color: '#9b59b6',
    },
    debugEvents: {
        maxHeight: '60vh',
        overflowY: 'auto',
    },
    debugEvent: {
        marginBottom: '0.5rem',
        padding: '0.5rem',
        backgroundColor: '#1a1a2e',
        borderRadius: '4px',
    },
    debugEventType: {
        display: 'inline-block',
        padding: '0.125rem 0.5rem',
        backgroundColor: '#9b59b6',
        borderRadius: '4px',
        fontSize: '0.75rem',
        marginBottom: '0.25rem',
    },
    debugEventContent: {
        margin: 0,
        fontSize: '0.7rem',
        color: '#888',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
    },
    debugSection: {
        marginTop: '1rem',
        padding: '0.5rem',
        backgroundColor: '#1a1a2e',
        borderRadius: '4px',
    },
    debugContent: {
        margin: 0,
        fontSize: '0.7rem',
        color: '#888',
        maxHeight: '200px',
        overflow: 'auto',
    },
};
