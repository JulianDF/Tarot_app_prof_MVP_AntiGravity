import fs from 'fs';
import path from 'path';

/**
 * Helper to get OpenAI API Key, filtering out stale system variables.
 * Prioritizes .env.local file content if available.
 */
export function getOpenAIKey(): string | undefined {
    try {
        // Assume running from project root (app/)
        const envPath = path.resolve(process.cwd(), '.env.local');

        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const match = content.match(/^OPENAI_API_KEY=(.*)$/m);
            if (match) {
                let key = match[1].trim();
                // Remove quotes if present
                key = key.replace(/^["']|["']$/g, '');

                // If the key found matches the user's request (e.g. valid format), return it.
                // We trust the file over process.env
                if (key.length > 0) return key;
            }
        }
    } catch (error) {
        console.warn('Failed to read .env.local directly, falling back to process.env', error);
    }

    return process.env.OPENAI_API_KEY;
}
