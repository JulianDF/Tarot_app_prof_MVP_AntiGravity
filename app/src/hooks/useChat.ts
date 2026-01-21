'use client';

import { useState, useCallback } from 'react';
import { useChatUI } from '@/contexts/ChatUIContext';
import { ChatStreamEvent, SpreadWithCards, SpreadLedgerEntry, Reading } from '@/types';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: Array<{ id: string; name: string; arguments: unknown }>;
    toolResults?: Array<{ name: string; result: unknown }>;
}

const SUMMARIZATION_THRESHOLD = 20;
const KEEP_RECENT = 3;

export function useChat() {
    const { addSpread, activeSpread, contractMockSpread } = useChatUI();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [spreadLedger, setSpreadLedger] = useState<SpreadLedgerEntry[]>([]);
    const [conversationSummary, setConversationSummary] = useState<string | null>(null);

    // Summarize older messages if threshold exceeded
    const summarizeIfNeeded = useCallback(async (allMessages: Message[]) => {
        // Only user/assistant messages count for summarization
        const chatMessages = allMessages.filter(m => m.role === 'user' || m.role === 'assistant');

        if (chatMessages.length <= SUMMARIZATION_THRESHOLD) {
            return { summary: conversationSummary, messagesToSend: chatMessages };
        }

        try {
            const response = await fetch('/api/chat/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
                    existingSummary: conversationSummary,
                    threshold: SUMMARIZATION_THRESHOLD,
                    keepRecent: KEEP_RECENT,
                }),
            });

            if (!response.ok) {
                console.error('Summarization failed');
                return { summary: conversationSummary, messagesToSend: chatMessages.slice(-20) };
            }

            const result = await response.json();

            if (result.needsSummarization && result.summary) {
                // Update summary state
                setConversationSummary(result.summary);

                // Keep only recent messages in local state
                const recentMessages = allMessages.slice(-KEEP_RECENT);
                setMessages(recentMessages);

                return {
                    summary: result.summary,
                    messagesToSend: recentMessages
                        .filter(m => m.role === 'user' || m.role === 'assistant')
                        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
                };
            }
        } catch (error) {
            console.error('Summarization error:', error);
        }

        return { summary: conversationSummary, messagesToSend: chatMessages.slice(-20) };
    }, [conversationSummary]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        // Contract the mock spread when user sends first message
        contractMockSpread();

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Check if we need to summarize before sending
            const { summary, messagesToSend } = await summarizeIfNeeded(newMessages);

            // Prepare api messages
            const apiMessages = Array.isArray(messagesToSend)
                ? messagesToSend.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
                : newMessages
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    activeSpread,
                    spreadLedger,
                    conversationSummary: summary,
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // Add placeholder for assistant
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: '',
                toolCalls: [],
                toolResults: []
            }]);

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

                        switch (event.type) {
                            case 'text':
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const lastIdx = updated.findLastIndex(m => m.role === 'assistant');
                                    if (lastIdx !== -1) {
                                        updated[lastIdx] = {
                                            ...updated[lastIdx],
                                            content: updated[lastIdx].content + event.content
                                        };
                                    }
                                    return updated;
                                });
                                break;

                            case 'tool_call':
                                // Add visible indicator for tool calls
                                const toolDisplayName = event.name === 'request_interpretation'
                                    ? '🔮 Consulting deeper wisdom...'
                                    : event.name === 'draw_cards'
                                        ? '🎴 Drawing cards...'
                                        : event.name === 'list_spreads'
                                            ? '📋 Reviewing spreads...'
                                            : `🔧 ${event.name}`;

                                setMessages(prev => [...prev, {
                                    id: crypto.randomUUID(),
                                    role: 'system',
                                    content: toolDisplayName
                                }]);

                                setMessages(prev => {
                                    const updated = [...prev];
                                    const lastIdx = updated.findLastIndex(m => m.role === 'assistant');
                                    if (lastIdx !== -1) {
                                        const last = updated[lastIdx];
                                        updated[lastIdx] = {
                                            ...last,
                                            toolCalls: [...(last.toolCalls || []), {
                                                id: event.id,
                                                name: event.name,
                                                arguments: event.arguments
                                            }]
                                        };
                                    }
                                    return updated;
                                });
                                break;

                            case 'tool_result':
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const lastIdx = updated.findLastIndex(m => m.role === 'assistant');
                                    if (lastIdx !== -1) {
                                        const last = updated[lastIdx];
                                        updated[lastIdx] = {
                                            ...last,
                                            toolResults: [...(last.toolResults || []), {
                                                name: event.name,
                                                result: event.result
                                            }]
                                        };
                                    }
                                    return updated;
                                });
                                break;

                            case 'spread_laid':
                                const spreadWithCards = (event as any).spreadWithCards as SpreadWithCards | undefined;

                                if (spreadWithCards) {
                                    addSpread(spreadWithCards);

                                    setMessages(prev => [...prev, {
                                        id: crypto.randomUUID(),
                                        role: 'system',
                                        content: `Spread laid: ${spreadWithCards.spread.name}`
                                    }]);
                                }
                                break;
                        }

                    } catch (e) {
                        console.error('Error parsing event:', e);
                    }
                }
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'system',
                content: 'Sorry, I encountered an error connecting to the spirits.'
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading, activeSpread, spreadLedger, addSpread, summarizeIfNeeded, contractMockSpread]);

    return {
        messages,
        isLoading,
        sendMessage,
        conversationSummary, // Expose for debugging if needed
    };
}
