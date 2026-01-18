/**
 * RNG Draw API — Implements the RNG cascade from spec/rng.md
 * 
 * Cascade order:
 * 1. ANU QRNG (primary)
 * 2. random.org (fallback)
 * 3. crypto.randomInt (local fallback for MVP, replaces slot-machine)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CardDraw, DrawRequest, DrawResponse, RngAttempt, RngProvenance } from '@/types';

// Constants from spec
const TOTAL_CARDS = 78;
const TOTAL_ORIENTED_STATES = 156; // 78 cards × 2 orientations
const UINT16_MAX = 65536;
const REJECTION_LIMIT = Math.floor(UINT16_MAX / TOTAL_ORIENTED_STATES) * TOTAL_ORIENTED_STATES;

export async function POST(request: NextRequest) {
    try {
        const body: DrawRequest = await request.json();
        const { n, allowDuplicates = false, allowReversals = true } = body;

        // Validation
        if (!n || n < 1) {
            return NextResponse.json({ error: 'n must be at least 1' }, { status: 400 });
        }
        if (!allowDuplicates && n > TOTAL_CARDS) {
            return NextResponse.json(
                { error: `Cannot draw ${n} unique cards from a deck of ${TOTAL_CARDS}` },
                { status: 400 }
            );
        }

        const result = await drawCards(n, allowDuplicates, allowReversals);
        return NextResponse.json(result);
    } catch (error) {
        console.error('RNG draw error:', error);
        return NextResponse.json(
            { error: 'Failed to draw cards' },
            { status: 500 }
        );
    }
}

/**
 * Main draw function with cascade fallback
 */
async function drawCards(
    n: number,
    allowDuplicates: boolean,
    allowReversals: boolean
): Promise<DrawResponse> {
    const draws: CardDraw[] = [];
    const usedBaseCards = new Set<number>();
    const attempts: RngAttempt[] = [];

    // Try each RNG method in cascade order
    const methods = [
        { method: 'qrng' as const, fn: fetchQrngNumbers },
        { method: 'random_org' as const, fn: fetchRandomOrgNumbers },
        { method: 'fallback' as const, fn: generateLocalRandomNumbers },
    ];

    for (const { method, fn } of methods) {
        if (draws.length >= n) break;

        const attempt: RngAttempt = {
            method,
            provider: method === 'qrng' ? 'anu_qrng' : method === 'random_org' ? 'random_org' : 'crypto',
            started_at: new Date().toISOString(),
            ended_at: '',
            success: false,
        };

        try {
            const needed = n - draws.length;
            // Request extra numbers to account for rejection sampling
            const requestSize = Math.min(needed * 3, 1024);

            const numbers = await fn(requestSize);
            attempt.ended_at = new Date().toISOString();
            attempt.success = true;
            attempt.meta = { requested: requestSize, received: numbers.length };

            // Process numbers with rejection sampling
            for (const num of numbers) {
                if (draws.length >= n) break;

                // Rejection sampling for unbiased distribution
                if (num >= REJECTION_LIMIT) continue;

                const orientedCard = num % TOTAL_ORIENTED_STATES;
                const baseCardId = orientedCard % TOTAL_CARDS;
                const isReversed = orientedCard >= TOTAL_CARDS;

                // Check uniqueness if required
                if (!allowDuplicates && usedBaseCards.has(baseCardId)) continue;

                // Add the draw
                draws.push({
                    cardId: baseCardId,
                    reversed: allowReversals ? isReversed : false,
                });

                if (!allowDuplicates) {
                    usedBaseCards.add(baseCardId);
                }
            }

            attempts.push(attempt);

            // If we got all cards, we're done
            if (draws.length >= n) break;

        } catch (error) {
            attempt.ended_at = new Date().toISOString();
            attempt.success = false;
            attempt.error = {
                message: error instanceof Error ? error.message : 'Unknown error',
            };
            attempts.push(attempt);
            // Continue to next method in cascade
        }
    }

    // Determine final method used
    const successfulAttempt = attempts.find(a => a.success);
    const methodUsed = successfulAttempt?.method || 'fallback';

    const provenance: RngProvenance = {
        method_used: methodUsed,
        attempts,
    };

    return { draws, provenance };
}

/**
 * Fetch random numbers from ANU QRNG API
 */
async function fetchQrngNumbers(length: number): Promise<number[]> {
    const apiKey = process.env.ANU_QRNG_API_KEY;
    if (!apiKey) {
        throw new Error('ANU_QRNG_API_KEY not configured');
    }

    const url = `https://api.quantumnumbers.anu.edu.au?type=uint16&length=${length}`;
    const response = await fetch(url, {
        headers: {
            'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
        throw new Error(`QRNG API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data as number[];
}

/**
 * Fetch random numbers from random.org API
 */
async function fetchRandomOrgNumbers(length: number): Promise<number[]> {
    const apiKey = process.env.RANDOM_ORG_API_KEY;

    // random.org JSON-RPC API
    const response = await fetch('https://api.random.org/json-rpc/4/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'generateIntegers',
            params: {
                apiKey: apiKey || 'demo', // Use demo key if not configured (limited)
                n: length,
                min: 0,
                max: 65535,
                replacement: true,
            },
            id: Date.now(),
        }),
        signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
        throw new Error(`random.org API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.result.random.data as number[];
}

/**
 * Generate local random numbers using crypto.randomInt
 * This is the MVP fallback instead of slot-machine UI
 */
async function generateLocalRandomNumbers(length: number): Promise<number[]> {
    const { randomInt } = await import('crypto');
    const numbers: number[] = [];

    for (let i = 0; i < length; i++) {
        numbers.push(randomInt(0, 65536));
    }

    return numbers;
}
