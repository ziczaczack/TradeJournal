/**
 * Pure helpers for the password recovery flow. Kept free of Supabase and React
 * so they can be unit tested in the project's node test environment.
 */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates the strength of a single password.
 *
 * Spaces are deliberately allowed so passphrases keep working; only a password
 * that is *entirely* whitespace is rejected. Composition rules (upper/digit/
 * symbol) are intentionally absent -- NIST SP 800-63B advises against them.
 *
 * Returns an error message, or null when the password is acceptable.
 */
export function validatePassword(password: string): string | null {
    if (!password) return 'Password is required.';
    if (!password.trim()) return 'Password cannot be only whitespace.';
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return null;
}

/**
 * Validates a new password and its confirmation.
 * Returns an error message, or null when the pair is acceptable.
 */
export function validateNewPassword(password: string, confirmation: string): string | null {
    const strengthError = validatePassword(password);
    if (strengthError) return strengthError;
    if (password !== confirmation) return 'Passwords do not match.';
    return null;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
    otp_expired: 'This reset link has expired or was already used. Request a new one.',
    access_denied: 'This reset link is no longer valid. Request a new one.',
    same_password: 'Your new password must be different from the old one.',
};

/**
 * Turns a Supabase error code into something a human can act on.
 * Unknown codes are passed through so nothing is silently swallowed.
 */
export function describeAuthError(code: string | null | undefined): string {
    if (!code) return 'Something went wrong. Please try again.';
    return AUTH_ERROR_MESSAGES[code] ?? code;
}

/**
 * Extracts Supabase's error code from a URL fragment or query string.
 * Supabase reports recovery failures as `#error=...&error_code=...`.
 */
export function readAuthErrorCode(fragment: string): string | null {
    if (!fragment) return null;
    const params = new URLSearchParams(fragment.replace(/^[#?]/, ''));
    return params.get('error_code') ?? params.get('error');
}
