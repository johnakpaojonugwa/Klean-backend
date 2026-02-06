import express from 'express';
import { login, register, refreshToken, logout, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import uploadMiddleware from '../utils/upload.js';
import { validateRegister, validateLogin } from '../middlewares/validationMiddleware.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/sign-up', validateRegister, uploadMiddleware, register);
router.post('/login', validateLogin, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', auth, logout);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password/:token', resetPassword);
export default router;  