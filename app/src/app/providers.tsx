'use client';

import { SessionProvider } from '@/context/sessionContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    );
}
