import { isValidEmail, isStrongPassword, isValidPhone, sanitizeInput } from '../../utils/validators.js';

describe('Input Validators - Comprehensive Suite', () => {
    describe('Email Validation', () => {
        it('should accept valid emails', () => {
            const validEmails = [
                'user@example.com',
                'john.doe@company.co.uk',
                'admin+tag@domain.io',
                'test_user123@subdomain.example.com'
            ];
            validEmails.forEach(email => {
                expect(isValidEmail(email)).toBe(true);
            });
        });

        it('should reject invalid emails', () => {
            const invalidEmails = [
                'notanemail',
                'user@',
                '@example.com',
                'user @example.com',
                'user@example',
                '',
                'userexample.com',
                'user@.com'
            ];
            invalidEmails.forEach(email => {
                expect(isValidEmail(email)).toBe(false);
            });
        });

        it('should handle null and undefined', () => {
            expect(isValidEmail(null)).toBe(false);
            expect(isValidEmail(undefined)).toBe(false);
        });
    });

    describe('Password Strength Validation', () => {
        it('should accept strong passwords', () => {
            const strongPasswords = [
                'SecurePass123!',
                'MyP@ssw0rd',
                'ComplexPass2024!',
                'Test@Password123',
                'VeryLongPassword123!@'
            ];
            strongPasswords.forEach(pass => {
                expect(isStrongPassword(pass)).toBe(true);
            });
        });

        it('should reject weak passwords', () => {
            const weakPasswords = [
                'password',           // no uppercase, no digit, no special char
                'PASSWORD123',        // no lowercase
                'Password',           // no digit, no special char
                'Pass123',            // no special character
                '12345678',           // no letters, no special char
                'abcdefgh',           // no uppercase, no digit, no special char
                'ABCDEFGH',           // no lowercase, no digit, no special char
                'NoNumber!',          // no digits
                'NoSpecial123',       // no special character
                'nouppper123!'        // no uppercase
            ];
            weakPasswords.forEach(pass => {
                expect(isStrongPassword(pass)).toBe(false);
            });
        });

        it('should require minimum 8 characters', () => {
            expect(isStrongPassword('Short1!')).toBe(false);
            expect(isStrongPassword('Longenough1!')).toBe(true);
        });

        it('should require uppercase, number, and special character', () => {
            expect(isStrongPassword('password123!')).toBe(false);  // No uppercase
            expect(isStrongPassword('PASSWORD123!')).toBe(false);  // No lowercase
            expect(isStrongPassword('Password!')).toBe(false);     // No number
            expect(isStrongPassword('Password123')).toBe(false);   // No special char
        });
    });

    describe('Phone Number Validation', () => {
        it('should accept valid phone numbers', () => {
            const validPhones = [
                '+1234567890',
                '1234567890',
                '+919876543210',
                '9876543210',
                '+442079460958'
            ];
            validPhones.forEach(phone => {
                expect(isValidPhone(phone)).toBe(true);
            });
        });

        it('should reject invalid phone numbers', () => {
            const invalidPhones = [
                '123',
                'abcdefghij',
                '+1234',
                '',
                'phone number'
            ];
            invalidPhones.forEach(phone => {
                expect(isValidPhone(phone)).toBe(false);
            });
        });
    });

    describe('Input Sanitization', () => {
        it('should remove script tags', () => {
            const malicious = '<script>alert("xss")</script>';
            expect(sanitizeInput(malicious)).not.toContain('<');
            expect(sanitizeInput(malicious)).not.toContain('>');
        });

        it('should remove dangerous HTML tags', () => {
            expect(sanitizeInput('Hello<img>World')).not.toContain('<');
            expect(sanitizeInput('Test>data')).not.toContain('>');
        });

        it('should preserve safe text', () => {
            const safeText = 'Hello World 123!@#$';
            const sanitized = sanitizeInput(safeText);
            expect(sanitized).toContain('Hello');
            expect(sanitized).toContain('World');
        });

        it('should trim whitespace', () => {
            expect(sanitizeInput('  spaced text  ')).toBe('spaced text');
        });

        it('should handle non-string input', () => {
            expect(sanitizeInput(123)).toBe(123);
            expect(sanitizeInput(null)).toBe(null);
            expect(sanitizeInput(undefined)).toBe(undefined);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very long strings', () => {
            const longString = 'a'.repeat(10000);
            expect(() => isValidEmail(longString + '@test.com')).not.toThrow();
        });

        it('should handle special unicode characters', () => {
            expect(sanitizeInput('Hello 你好 مرحبا')).toContain('Hello');
        });

        it('should handle whitespace-only input', () => {
            expect(sanitizeInput('   ')).toBe('');
        });
    });
});
