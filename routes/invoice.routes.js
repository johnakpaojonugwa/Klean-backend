import express from "express";
import { createInvoice, getInvoiceById, getMyInvoices, downloadInvoice } from "../controllers/invoice.controller.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Managers can create invoices when an order is finalized
router.post('/', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), createInvoice);

// Customers can see their own, Managers can see branch invoices
router.get('/my-invoices', auth, getMyInvoices);

// View specific invoice details
router.get('/:id', auth, getInvoiceById);

// Download PDF
router.get('/:id/download', auth, downloadInvoice);

export default router;