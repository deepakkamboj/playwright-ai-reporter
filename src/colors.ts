/**
 * Colors.ts
 *
 * This file defines a set of ANSI color codes as constants that can be used to
 * style console log outputs in the project. These colors are used to enhance
 * the readability of terminal output by distinguishing different types of log
 * messages (e.g., info, warnings, errors, success).
 *
 * Purpose:
 * - To centralize the ANSI color codes, making it easier to maintain and
 *   update the color scheme across the project.
 * - To provide a consistent and readable way to format log messages.
 *
 * Usage:
 * - Import the `Colors` object from this file wherever colored console logs are
 *   needed.
 * - Use the defined properties in this object to apply color formatting to
 *   console.log statements.
 *
 * Example:
 * ```
 * import { Colors } from '@utils/Colors';
 *
 * console.log(`${Colors.FgGreen}[SUCCESS]${Colors.Reset} Operation completed successfully.`);
 * console.error(`${Colors.FgRed}[ERROR]${Colors.Reset} An error occurred.`);
 * ```
 */

export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    fgBlack: '\x1b[30m',
    fgRed: '\x1b[31m',
    fgGreen: '\x1b[32m',
    fgYellow: '\x1b[33m',
    fgBlue: '\x1b[34m',
    fgMagenta: '\x1b[35m',
    fgCyan: '\x1b[36m',
    fgWhite: '\x1b[37m',

    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',

    fgGray: '\x1b[90m',
    fgMagentaBright: '\x1b[95m',
};
