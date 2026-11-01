/**
 * chunk.js - Troceado inteligente de texto con solapamiento (overlap) para grandes documentos
 */

export function chunkText(text, maxChunkSize = 4000, overlap = 400) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    if (!Number.isInteger(maxChunkSize) || maxChunkSize <= 0) {
        throw new RangeError('maxChunkSize debe ser un entero mayor que cero.');
    }
    if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxChunkSize) {
        throw new RangeError('overlap debe ser un entero entre cero y maxChunkSize - 1.');
    }

    if (text.length <= maxChunkSize) {
        return [{ id: 0, text: text, start: 0, end: text.length }];
    }

    const chunks = [];
    let start = 0;
    let chunkId = 0;

    while (start < text.length) {
        let end = start + maxChunkSize;
        
        if (end < text.length) {
            // Intentar cortar en un salto de línea o espacio para no romper palabras abruptamente
            const lastNewline = text.lastIndexOf('\n', end);
            if (lastNewline > start + maxChunkSize / 2) {
                end = lastNewline + 1;
            } else {
                const lastSpace = text.lastIndexOf(' ', end);
                if (lastSpace > start + maxChunkSize / 2) {
                    end = lastSpace + 1;
                }
            }
        } else {
            end = text.length;
        }

        chunks.push({
            id: chunkId++,
            text: text.slice(start, end).trim(),
            start: start,
            end: end
        });

        if (end === text.length) break;
        start = end - overlap;
        if (start < 0) start = 0;
    }

    return chunks;
}