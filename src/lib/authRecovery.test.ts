import { describe, it, expect } from 'vitest';
import {
    validateNewPassword,
    validatePassword,
    describeAuthError,
    readAuthErrorCode,
    MIN_PASSWORD_LENGTH,
} from './authRecovery';

describe('validateNewPassword', () => {
    it('rejects a password shorter than the minimum length', () => {
        expect(validateNewPassword('short', 'short')).toBe(
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        );
    });

    it('rejects an empty password', () => {
        expect(validateNewPassword('', '')).toBe('Password is required.');
    });

    it('rejects when the confirmation does not match', () => {
        expect(validateNewPassword('correct-horse', 'correct-hors')).toBe('Passwords do not match.');
    });

    it('returns null for a valid matching password', () => {
        expect(validateNewPassword('correct-horse', 'correct-horse')).toBeNull();
    });

    it('does not trim the password when comparing', () => {
        expect(validateNewPassword('correct-horse ', 'correct-horse')).toBe('Passwords do not match.');
    });
});

describe('describeAuthError', () => {
    it('explains an expired or already-used recovery link', () => {
        expect(describeAuthError('otp_expired')).toBe(
            'This reset link has expired or was already used. Request a new one.'
        );
    });

    it('explains an invalid link', () => {
        expect(describeAuthError('access_denied')).toBe(
            'This reset link is no longer valid. Request a new one.'
        );
    });

    it('rejects reusing the current password', () => {
        expect(describeAuthError('same_password')).toBe(
            'Your new password must be different from the old one.'
        );
    });

    it('falls back to the raw code when it is unrecognised', () => {
        expect(describeAuthError('something_unexpected')).toBe('something_unexpected');
    });

    it('returns a generic message when there is no code', () => {
        expect(describeAuthError(null)).toBe('Something went wrong. Please try again.');
    });
});

describe('readAuthErrorCode', () => {
    it('reads the error code from the URL hash', () => {
        expect(
            readAuthErrorCode('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid')
        ).toBe('otp_expired');
    });

    it('reads the error code from the query string', () => {
        expect(readAuthErrorCode('?error=access_denied&error_code=otp_expired')).toBe('otp_expired');
    });

    it('falls back to the error param when no error_code is present', () => {
        expect(readAuthErrorCode('#error=access_denied')).toBe('access_denied');
    });

    it('returns null when the URL carries no error', () => {
        expect(readAuthErrorCode('#access_token=abc&type=recovery')).toBeNull();
    });

    it('returns null for an empty fragment', () => {
        expect(readAuthErrorCode('')).toBeNull();
    });
});

describe('validatePassword', () => {
    it('rejects a password made only of spaces', () => {
        expect(validatePassword('          ')).toBe('Password cannot be only whitespace.');
    });

    it('rejects a password made only of tabs and newlines', () => {
        expect(validatePassword('\t\t\n\t\t\n\t\t')).toBe('Password cannot be only whitespace.');
    });

    it('reports whitespace before length so the message is actionable', () => {
        expect(validatePassword('   ')).toBe('Password cannot be only whitespace.');
    });

    it('accepts a passphrase containing spaces', () => {
        expect(validatePassword('correct horse battery staple')).toBeNull();
    });

    it('accepts a password with leading and trailing spaces around real characters', () => {
        expect(validatePassword(' hunter2 is mine ')).toBeNull();
    });

    it('rejects a password shorter than the minimum length', () => {
        expect(validatePassword('short')).toBe(
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        );
    });

    it('rejects an empty password', () => {
        expect(validatePassword('')).toBe('Password is required.');
    });
});

describe('validateNewPassword whitespace handling', () => {
    it('rejects a whitespace-only password even when the confirmation matches', () => {
        expect(validateNewPassword('        ', '        ')).toBe(
            'Password cannot be only whitespace.'
        );
    });

    it('accepts a matching passphrase that contains spaces', () => {
        expect(
            validateNewPassword('correct horse battery staple', 'correct horse battery staple')
        ).toBeNull();
    });
});
