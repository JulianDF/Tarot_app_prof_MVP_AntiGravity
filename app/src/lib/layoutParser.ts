/**
 * Layout Parser — Parse spread layout descriptors into renderable grids
 * 
 * Layout descriptor parsing rules (from spec):
 * - Rows are separated by \n
 * - Tokens are split by comma or whitespace; if no separators, parse per character
 * - X = empty slot
 * - Integer tokens are 1-based position indexes (e.g., 1 maps to positions[0])
 */

import { LayoutCell, LayoutGrid } from '@/types';

/**
 * Parse a layout descriptor string into a 2D grid
 * @param descriptor - Layout string like "X5X\n213\nX4X"
 * @returns 2D array of LayoutCells
 */
export function parseLayoutDescriptor(descriptor: string): LayoutGrid {
    const rows = descriptor.split('\n');

    return rows.map(row => {
        const tokens = tokenizeRow(row);
        return tokens.map(parseToken);
    });
}

/**
 * Tokenize a row based on the spec rules:
 * - Split by comma or whitespace
 * - If no separators found, parse per character
 */
function tokenizeRow(row: string): string[] {
    // Check if row has commas or spaces as separators
    if (row.includes(',') || row.includes(' ')) {
        // Split by comma or space, filter empty tokens
        return row.split(/[,\s]+/).filter(token => token.length > 0);
    }

    // No separators: parse per character
    return row.split('');
}

/**
 * Parse a single token into a LayoutCell
 */
function parseToken(token: string): LayoutCell {
    const trimmed = token.trim().toUpperCase();

    // X = empty slot
    if (trimmed === 'X') {
        return { type: 'empty' };
    }

    // Try to parse as integer (1-based position index)
    const positionNumber = parseInt(trimmed, 10);
    if (!isNaN(positionNumber) && positionNumber > 0) {
        // Convert 1-based to 0-based index
        return { type: 'position', positionIndex: positionNumber - 1 };
    }

    // Fallback: treat unknown tokens as empty
    console.warn(`Unknown layout token: "${token}", treating as empty`);
    return { type: 'empty' };
}

/**
 * Get the dimensions of a layout grid
 */
export function getGridDimensions(grid: LayoutGrid): { rows: number; cols: number } {
    const rows = grid.length;
    const cols = Math.max(...grid.map(row => row.length), 0);
    return { rows, cols };
}

/**
 * Find the position of a card in the grid by its position index
 */
export function findPositionInGrid(
    grid: LayoutGrid,
    positionIndex: number
): { row: number; col: number } | null {
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            const cell = grid[row][col];
            if (cell.type === 'position' && cell.positionIndex === positionIndex) {
                return { row, col };
            }
        }
    }
    return null;
}

/**
 * Validate that a layout contains all expected positions
 */
export function validateLayout(grid: LayoutGrid, expectedPositions: number): boolean {
    const foundPositions = new Set<number>();

    for (const row of grid) {
        for (const cell of row) {
            if (cell.type === 'position') {
                foundPositions.add(cell.positionIndex);
            }
        }
    }

    // Check all positions 0 to expectedPositions-1 are present
    for (let i = 0; i < expectedPositions; i++) {
        if (!foundPositions.has(i)) {
            console.warn(`Missing position ${i + 1} in layout`);
            return false;
        }
    }

    return foundPositions.size === expectedPositions;
}
