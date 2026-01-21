/**
 * Chat Logger — Persistent logging for model behavior analysis
 * 
 * Logs all tool calls, model decisions, and interactions to files
 * for debugging and iteration on AI behavior.
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const CHAT_LOG_FILE = path.join(LOG_DIR, 'chat.log');
const TOOL_LOG_FILE = path.join(LOG_DIR, 'tools.log');

// Ensure log directory exists
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function formatTimestamp(): string {
    return new Date().toISOString();
}

function writeLog(file: string, entry: string) {
    ensureLogDir();
    const line = `[${formatTimestamp()}] ${entry}\n`;
    fs.appendFileSync(file, line, 'utf-8');
}

/**
 * Log a chat session start
 */
export function logSessionStart(sessionId: string, messageCount: number) {
    writeLog(CHAT_LOG_FILE, `\n${'='.repeat(80)}`);
    writeLog(CHAT_LOG_FILE, `SESSION START | ID: ${sessionId} | Messages: ${messageCount}`);
    writeLog(CHAT_LOG_FILE, `${'='.repeat(80)}`);
}

/**
 * Log user message
 */
export function logUserMessage(content: string) {
    const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content;
    writeLog(CHAT_LOG_FILE, `USER: ${truncated}`);
}

/**
 * Log when mini model is called
 */
export function logMiniCall(promptSummary: string) {
    writeLog(CHAT_LOG_FILE, `MINI CALL | Context: ${promptSummary}`);
}

/**
 * Log model response start (before streaming)
 */
export function logModelResponseStart() {
    writeLog(CHAT_LOG_FILE, `MINI RESPONSE START...`);
}

/**
 * Log tool call decision
 */
export function logToolCall(toolName: string, args: unknown) {
    const argsStr = JSON.stringify(args, null, 2);
    writeLog(CHAT_LOG_FILE, `TOOL CALL: ${toolName}`);
    writeLog(TOOL_LOG_FILE, `TOOL: ${toolName}\nARGS: ${argsStr}\n`);
}

/**
 * Log tool result
 */
export function logToolResult(toolName: string, success: boolean, resultSummary: string) {
    writeLog(CHAT_LOG_FILE, `TOOL RESULT: ${toolName} | Success: ${success} | ${resultSummary}`);
    writeLog(TOOL_LOG_FILE, `RESULT: ${toolName} | ${success ? 'OK' : 'FAIL'} | ${resultSummary}\n`);
}

/**
 * Log thinking model handoff
 */
export function logThinkingHandoff(spreadName: string, question: string) {
    writeLog(CHAT_LOG_FILE, `THINKING HANDOFF | Spread: ${spreadName} | Question: ${question}`);
    writeLog(TOOL_LOG_FILE, `THINKING MODEL INVOKED\nSpread: ${spreadName}\nQuestion: ${question}\n`);
}

/**
 * Log when mini generates text (vs calling tools)
 */
export function logMiniTextGeneration(textLength: number) {
    writeLog(CHAT_LOG_FILE, `MINI TEXT | Length: ${textLength} chars (mini generated response without tool call)`);
}

/**
 * Log model decision - when it chooses to respond directly vs use tools
 */
export function logDecision(decision: 'tool_call' | 'direct_response', toolName?: string) {
    if (decision === 'tool_call') {
        writeLog(CHAT_LOG_FILE, `DECISION: Call tool -> ${toolName}`);
    } else {
        writeLog(CHAT_LOG_FILE, `DECISION: Generate direct response (no tool call)`);
    }
}

/**
 * Log session context summary
 */
export function logContext(activeSpread: string | null, ledgerCount: number, hasHistory: boolean) {
    writeLog(CHAT_LOG_FILE, `CONTEXT | ActiveSpread: ${activeSpread || 'none'} | PreviousSpreads: ${ledgerCount} | HasHistory: ${hasHistory}`);
}

/**
 * Log an error
 */
export function logError(source: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    writeLog(CHAT_LOG_FILE, `ERROR [${source}]: ${message}`);
}

/**
 * Log session end
 */
export function logSessionEnd(totalToolCalls: number, thinkingCalls: number) {
    writeLog(CHAT_LOG_FILE, `SESSION END | TotalToolCalls: ${totalToolCalls} | ThinkingCalls: ${thinkingCalls}`);
    writeLog(CHAT_LOG_FILE, `${'='.repeat(80)}\n`);
}

// Context log for debugging what's actually sent to models
const CONTEXT_LOG_FILE = path.join(LOG_DIR, 'context.log');

/**
 * Log the full context sent to a model (for debugging)
 */
export function logModelContext(model: 'mini' | 'thinking', context: {
    systemPrompt?: string;
    messages?: unknown[];
    conversationSummary?: string;
    spreadContext?: string;
    ledger?: unknown[];
    thinkingPrompt?: string;
}) {
    ensureLogDir();
    const timestamp = formatTimestamp();
    let output = `\n${'='.repeat(80)}\n`;
    output += `[${timestamp}] MODEL: ${model.toUpperCase()}\n`;
    output += `${'='.repeat(80)}\n`;

    if (context.systemPrompt) {
        output += `\n--- SYSTEM PROMPT ---\n${context.systemPrompt}\n`;
    }
    if (context.conversationSummary) {
        output += `\n--- CONVERSATION SUMMARY ---\n${context.conversationSummary}\n`;
    }
    if (context.spreadContext) {
        output += `\n--- SPREAD CONTEXT ---\n${context.spreadContext}\n`;
    }
    if (context.ledger && context.ledger.length > 0) {
        output += `\n--- LEDGER (${context.ledger.length} entries) ---\n${JSON.stringify(context.ledger, null, 2)}\n`;
    }
    if (context.messages) {
        output += `\n--- MESSAGES (${context.messages.length}) ---\n`;
        for (const msg of context.messages as Array<{ role: string; content?: string }>) {
            const content = typeof msg.content === 'string'
                ? (msg.content.length > 300 ? msg.content.substring(0, 300) + '...[truncated]' : msg.content)
                : '[non-text]';
            output += `[${msg.role}]: ${content}\n`;
        }
    }
    if (context.thinkingPrompt) {
        output += `\n--- THINKING PROMPT ---\n${context.thinkingPrompt}\n`;
    }

    output += `\n${'='.repeat(80)}\n`;
    fs.appendFileSync(CONTEXT_LOG_FILE, output, 'utf-8');
}
