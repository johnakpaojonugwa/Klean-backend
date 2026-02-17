import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { isValidEmail, isStrongPassword } from "../utils/validators.js";
import { smsService } from "../utils/smsService.js";
import { emailService } from "../utils/emailService.js";
import crypto from "crypto";

// Helper to generate tokens
const generateTokens = (userId, role, branchId = null) => {
    const accessToken = jwt.sign(
        { id: userId, role, branchId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || "1h" }
    );

    const refreshToken = jwt.sign(
        { id: userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d" }
    );

    return { accessToken, refreshToken };
};

// Register
export const register = async (req, res, next) => {
    try {
        const { fullname, email, password, confirmPassword, role, branchId } = req.body || {};

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            logger.warn(`Registration attempt with existing email: ${email}`);
            return sendError(res, 409, "Email already registered");
        }

        const avatar = req.files?.avatar?.[0]?.path || null;

        // Password hashing is now handled by model pre-save hook
        const user = await User.create({
            fullname: fullname.trim(),
            email: email.toLowerCase(),
            password,
            confirmPassword,
            role,
            branchId: branchId || null, // Ensure branchId is set from the token or request body
            avatar
        });

        // welcome SMS
        if (user.role === 'CUSTOMER') {
            emailService.sendWelcomeEmail(user);
            await smsService.sendWelcomeSMS(req.body.phoneNumber, user.fullname);
        }

        const { accessToken, refreshToken } = generateTokens(user._id, user.role, user.branchId);

        // Store refresh token securely

        logger.info(`User registered successfully: ${user.email}`);

        return sendResponse(res, 201, true, "User registered successfully", {
            user: {
                _id: user._id,
                fullname: user.fullname,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                branchId: user.branchId
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        logger.error("Registration error:", error.message);
        next(error);
    }
};

// Login
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        // Find user and explicitly select password field
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user || !user.isActive) {
            logger.warn(`Login attempt failed for email: ${email}`);
            return sendError(res, 401, "Invalid credentials");
        }

        // Compare password using model method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logger.warn(`Failed password attempt for: ${email}`);
            return sendError(res, 401, "Invalid credentials");
        }

        const { accessToken, refreshToken } = generateTokens(user._id, user.role, user.branchId);

        // Update last login
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        logger.info(`User logged in successfully: ${user.email}`);

        return sendResponse(res, 200, true, "Login successful", {
            user: {
                _id: user._id,
                fullname: user.fullname,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                branchId: user.branchId,
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        logger.error("Login error:", error.message);
        next(error);
    }
};

// Refresh Token
export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return sendError(res, 400, "Refresh token is required");
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.isActive) {
            return sendError(res, 401, "Invalid refresh token");
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role, user.branchId);

        return sendResponse(res, 200, true, "Token refreshed", {
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        logger.error("Token refresh error:", error.message);
        return sendError(res, 401, "Invalid or expired refresh token");
    }
};

// Logout
export const logout = async (req, res, next) => {
    try {
        logger.info(`User logged out: ${req.user.id}`);
        return sendResponse(res, 200, true, "Logged out successfully");
    } catch (error) {
        next(error);
    }
};

// Forgot Password
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email || !isValidEmail(email)) {
            return sendError(res, 400, "Valid email is required");
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        const successMessage = "If an account exists with that email, a reset link has been sent.";

        if (!user) {
            return sendResponse(res, 200, true, successMessage);
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save({ validateBeforeSave: false });

        emailService.sendPasswordResetEmail(user, resetToken)
            .then(() => {
                logger.info(`Password reset email successfully sent to: ${user.email}`);
            })
            .catch(async (error) => {
                logger.error(`Background Email delivery failed for ${user.email}:`, error.message);
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                await user.save({ validateBeforeSave: false });
            });

        return sendResponse(res, 200, true, successMessage);

    } catch (error) {
        logger.error("Forgot password error:", error.message);
        next(error);
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        // Validation - strong requirements
        const errors = [];
        if (!password || !isStrongPassword(password)) {
            errors.push("Password must be at least 8 characters with uppercase, number, and special character");
        }

        if (password !== confirmPassword) {
            errors.push("Passwords do not match");
        }

        if (errors.length > 0) {
            return sendError(res, 400, "Validation failed", errors);
        }

        // Validate token format
        if (!token || typeof token !== 'string' || token.length === 0) {
            return sendError(res, 400, "Token is invalid or has expired");
        }

        // Hash the incoming token to compare with what we have in the DB
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        // Find user with valid token and check if it hasn't expired
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return sendError(res, 400, "Token is invalid or has expired");
        }

        // Update password and clear reset fields
        user.password = password; 
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        logger.info(`Password reset successful for user: ${user.email}`);

        // Log them in automatically
        const { accessToken, refreshToken } = generateTokens(user._id, user.role);

        return sendResponse(res, 200, true, "Password reset successful", {
            user: {
                _id: user._id,
                fullname: user.fullname,
                email: user.email,
                role: user.role,
                branchId: user.branchId,
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        next(error);
    }
};