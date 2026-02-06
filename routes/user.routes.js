import express from "express";
import { getAllUsers, getSingleUser, updateUser, deleteUser } from "../controllers/user.controller.js";
import uploadMiddleware from "../utils/upload.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();
// Route to get all users
router.get('/', auth, authorize('SUPER_ADMIN'), getAllUsers);
// Route to get singleUser
router.get('/:userId', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getSingleUser);
//Route to update user
router.put('/:userId', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), uploadMiddleware, updateUser);
// Route to delete user
router.delete('/:userId', auth, authorize('SUPER_ADMIN'), deleteUser);

export default router;
