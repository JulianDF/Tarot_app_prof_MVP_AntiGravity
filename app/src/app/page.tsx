'use client';

import { ChatUIProvider } from '@/contexts/ChatUIContext';
import { ChatLayout } from '@/components/chat/ChatLayout';

export default function Page() {
    return (
        <ChatUIProvider>
            <ChatLayout />
        </ChatUIProvider>
    );
}
