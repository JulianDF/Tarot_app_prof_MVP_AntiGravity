'use client';

import { ChatUIProvider } from '@/contexts/ChatUIContext';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MobileFrame } from '@/components/MobileFrame';

export default function Page() {
    return (
        <MobileFrame>
            <ChatUIProvider>
                <ChatLayout />
            </ChatUIProvider>
        </MobileFrame>
    );
}
