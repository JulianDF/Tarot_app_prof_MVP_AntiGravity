'use client';

import React, { useState, useEffect, useRef } from 'react';

interface MobileFrameProps {
    children: React.ReactNode;
}

// Device presets with their dimensions
const DEVICE_PRESETS = {
    'iPhone 14 Pro': { width: 393, height: 852 },
    'iPhone SE': { width: 375, height: 667 },
    'iPhone 14 Pro Max': { width: 430, height: 932 },
    'Pixel 7': { width: 412, height: 915 },
    'Galaxy S23': { width: 360, height: 780 },
} as const;

type DeviceName = keyof typeof DEVICE_PRESETS;

const CONTROLS_BAR_HEIGHT = 48;
const FRAME_PADDING = 40; // Total vertical padding around phone
const BEZEL_SIZE = 24; // Border around phone screen

export function MobileFrame({ children }: MobileFrameProps) {
    const [isMobileView, setIsMobileView] = useState(true);
    const [selectedDevice, setSelectedDevice] = useState<DeviceName>('iPhone 14 Pro');
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate scale to fit phone in available space
    useEffect(() => {
        const calculateScale = () => {
            if (!isMobileView) return;

            const device = DEVICE_PRESETS[selectedDevice];
            const availableHeight = window.innerHeight - CONTROLS_BAR_HEIGHT - FRAME_PADDING;
            const availableWidth = window.innerWidth - FRAME_PADDING;

            // Total phone dimensions including bezel
            const phoneHeight = device.height + (BEZEL_SIZE * 2);
            const phoneWidth = device.width + (BEZEL_SIZE * 2);

            // Calculate scale needed to fit
            const scaleY = availableHeight / phoneHeight;
            const scaleX = availableWidth / phoneWidth;
            const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

            setScale(newScale);
        };

        calculateScale();
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, [isMobileView, selectedDevice]);

    // Check localStorage on mount for persisted preference
    useEffect(() => {
        const saved = localStorage.getItem('mobileFrameEnabled');
        if (saved !== null) {
            setIsMobileView(saved === 'true');
        }
        const savedDevice = localStorage.getItem('mobileFrameDevice');
        if (savedDevice && savedDevice in DEVICE_PRESETS) {
            setSelectedDevice(savedDevice as DeviceName);
        }
    }, []);

    // Persist preference
    const toggleMobileView = () => {
        const newValue = !isMobileView;
        setIsMobileView(newValue);
        localStorage.setItem('mobileFrameEnabled', String(newValue));
    };

    const handleDeviceChange = (device: DeviceName) => {
        setSelectedDevice(device);
        localStorage.setItem('mobileFrameDevice', device);
    };

    const device = DEVICE_PRESETS[selectedDevice];

    // Full-width mode - just render children with toggle button
    if (!isMobileView) {
        return (
            <div style={styles.fullWidthContainer}>
                {children}
                <button
                    onClick={toggleMobileView}
                    style={styles.toggleButton}
                    title="Switch to mobile preview"
                >
                    📱
                </button>
            </div>
        );
    }

    // Mobile frame mode
    return (
        <div style={styles.frameContainer} ref={containerRef}>
            {/* Controls bar */}
            <div style={styles.controlsBar}>
                <span style={styles.label}>📱 Mobile Preview</span>
                <select
                    value={selectedDevice}
                    onChange={(e) => handleDeviceChange(e.target.value as DeviceName)}
                    style={styles.deviceSelect}
                >
                    {Object.entries(DEVICE_PRESETS).map(([name, dims]) => (
                        <option key={name} value={name}>
                            {name} ({dims.width}×{dims.height})
                        </option>
                    ))}
                </select>
                <span style={styles.scaleLabel}>{Math.round(scale * 100)}%</span>
                <button
                    onClick={toggleMobileView}
                    style={styles.exitButton}
                    title="Switch to full-width view"
                >
                    ✕ Exit Preview
                </button>
            </div>

            {/* Phone frame wrapper for centering */}
            <div style={styles.phoneWrapper}>
                <div
                    style={{
                        ...styles.phoneFrame,
                        width: device.width,
                        height: device.height,
                        transform: `scale(${scale})`,
                        transformOrigin: 'center center',
                    }}
                >
                    {/* Notch */}
                    <div style={styles.notch} />

                    {/* Screen content */}
                    <div style={styles.screen}>
                        {children}
                    </div>

                    {/* Home indicator */}
                    <div style={styles.homeIndicator} />
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    fullWidthContainer: {
        width: '100%',
        height: '100vh',
        position: 'relative',
    },
    frameContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0a12',
        overflow: 'hidden',
    },
    controlsBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 24px',
        backgroundColor: '#1a1a2e',
        width: '100%',
        borderBottom: '1px solid #2a2a3e',
        flexShrink: 0,
        height: '48px',
    },
    label: {
        color: '#a0a0b0',
        fontSize: '14px',
        fontWeight: 500,
    },
    scaleLabel: {
        color: '#707080',
        fontSize: '12px',
        fontFamily: 'monospace',
    },
    deviceSelect: {
        backgroundColor: '#2a2a3e',
        color: '#e0e0e0',
        border: '1px solid #3a3a4e',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '13px',
        cursor: 'pointer',
        outline: 'none',
    },
    exitButton: {
        marginLeft: 'auto',
        backgroundColor: 'transparent',
        color: '#a0a0b0',
        border: '1px solid #3a3a4e',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    phoneWrapper: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'hidden',
    },
    phoneFrame: {
        position: 'relative',
        backgroundColor: '#1a1a1a',
        borderRadius: '44px',
        border: '12px solid #2a2a2a',
        boxShadow: `
            0 0 0 2px #3a3a3a,
            0 20px 60px rgba(0, 0, 0, 0.5),
            inset 0 0 20px rgba(0, 0, 0, 0.3)
        `,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
    },
    notch: {
        position: 'absolute',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120px',
        height: '28px',
        backgroundColor: '#1a1a1a',
        borderRadius: '20px',
        zIndex: 10,
    },
    screen: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#0f0f1a',
        contain: 'strict',
        isolation: 'isolate',
    },
    homeIndicator: {
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120px',
        height: '4px',
        backgroundColor: '#4a4a5a',
        borderRadius: '2px',
    },
    toggleButton: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: '#2a2a3e',
        border: '2px solid #4a4a5e',
        fontSize: '20px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        zIndex: 1000,
    },
};
