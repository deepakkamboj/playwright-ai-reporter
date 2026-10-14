/**
 * Splits an AI fix response into the human-readable analysis and the corrected file.
 *
 * The prompt asks the model to end with a "## Corrected file" heading followed by one fenced code
 * block holding the complete corrected source. Only content under that heading is ever treated as
 * a replacement file. A code snippet elsewhere in the answer is explanation, not a patch.
 */

export interface ParsedFixResponse {
    /** Everything before the "Corrected file" heading, or the whole response if there is none. */
    analysis: string;
    /** Full corrected source, only when the heading and a fenced block are both present. */
    patchedSource?: string;
}

export const CORRECTED_FILE_HEADING = '## Corrected file';

const HEADING = /^#{1,6}\s*corrected file\s*$/im;
const FENCED_BLOCK = /```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n```/;

export function parseFixResponse(content: string): ParsedFixResponse {
    const heading = HEADING.exec(content);
    if (!heading) {
        return {analysis: content.trim()};
    }

    const analysis = content.slice(0, heading.index).trim();
    const afterHeading = content.slice(heading.index + heading[0].length);
    const block = FENCED_BLOCK.exec(afterHeading);

    if (!block || !block[1]) {
        return {analysis};
    }

    return {analysis, patchedSource: block[1]};
}
