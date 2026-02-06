import { isValidEmail, isStrongPassword } from '../utils/validators.js';

export const validateRegister = (req, res, next) => {
    const { fullname, email, password } = req.body || {};

    const errors = [];

    if (!fullname || fullname.trim().length < 3) {
        errors.push("Full name must be at least 3 characters");
    }
    if (!email || !isValidEmail(email)) {
        errors.push("Valid email is required");
    }
    if (!password || !isStrongPassword(password)) {
        errors.push("Password must be at least 8 characters with uppercase, number, and special character");
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    next();
};

export const validateLogin = (req, res, next) => {
    const { email, password } = req.body || {};

    const errors = [];

    if (!email || !isValidEmail(email)) {
        errors.push("Valid email is required");
    }
    if (!password || password.length === 0) {
        errors.push("Password is required");
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    next();
};

export const validateCreateOrder = (req, res, next) => {
    const { branchId, customerId, items } = req.body || {};
    const errors = [];

    if (!branchId) errors.push("Branch ID is required");
    if (!customerId) errors.push("Customer ID is required");
    if (!items || !Array.isArray(items) || items.length === 0) errors.push("At least one item is required");

    items?.forEach((item, i) => {
        if (!item.serviceName) errors.push(`Item ${i + 1}: serviceName is required`);
        if (!item.quantity || item.quantity <= 0) errors.push(`Item ${i + 1}: quantity must be greater than 0`);
        if (!item.unitPrice || item.unitPrice < 0) errors.push(`Item ${i + 1}: unitPrice is required`);
    });

    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    next();
};

export const validateComment = (req, res, next) => {
    const { text } = req.body || {};

    if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    next();
};

export const validateUpdateUser = (req, res, next) => {
    const { email, fullname, role } = req.body || {};
    const errors = [];

    if (email && !isValidEmail(email.trim())) errors.push("Valid email is required");
    if (fullname && fullname.trim().length < 3) errors.push("Full name must be at least 3 characters");
    if (role && !['SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER'].includes(role)) errors.push("Invalid role");

    if (errors.length > 0) return res.status(400).json({ success: false, message: "Validation failed", errors });

    next();
};
