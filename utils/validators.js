// Email validation regex
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex
export const phoneRegex = /^\+?[0-9]{7,15}$/;

// Validate email format
export const isValidEmail = (email) => emailRegex.test(email);

// Validate password strength (minimum 8 chars, at least one uppercase, one number, one special char)
export const isStrongPassword = (password) => {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
};

// Validate phone number
export const isValidPhone = (phone) => phoneRegex.test(phone);

// Sanitize user input
export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, ''); // Remove potential script tags
};
