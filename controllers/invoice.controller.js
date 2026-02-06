import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import { generateInvoicePDF } from "../utils/pdfGenerator.js";
import { sendResponse, sendError } from "../utils/response.js";

// Helper for professional invoice numbers
const generateInvoiceNumber = async () => {
    const count = await Invoice.countDocuments();
    const date = new Date().getFullYear();
    return `INV-${date}-${(count + 1).toString().padStart(4, '0')}`;
};

export const createInvoice = async (req, res, next) => {
    try {
        const { orderId, paymentMethod, notes } = req.body;
        
        const order = await Order.findById(orderId).populate('items.serviceId');
        if (!order) return sendError(res, 404, "Order not found");

        const invoiceNumber = await generateInvoiceNumber();

        const invoice = await Invoice.create({
            invoiceNumber,
            orderId: order._id,
            customerId: order.customerId,
            branchId: order.branchId,
            items: order.items.map(item => ({
                description: item.serviceName || "Laundry Service",
                quantity: item.quantity,
                unitPrice: item.price,
                total: item.quantity * item.price
            })),
            subtotal: order.totalAmount,
            totalAmount: order.totalAmount,
            paymentStatus: order.paymentStatus,
            paymentMethod,
            notes
        });

        return sendResponse(res, 201, true, "Invoice generated", invoice);
    } catch (error) {
        next(error);
    }
};

export const getInvoiceById = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId', 'fullname email phone')
            .populate('branchId', 'name address phone branchCode');
            
        if (!invoice) return sendError(res, 404, "Invoice not found");
        return sendResponse(res, 200, true, "Invoice details", invoice);
    } catch (error) {
        next(error);
    }
};

export const getMyInvoices = async (req, res, next) => {
    try {
        const query = req.user.role === 'CUSTOMER' 
            ? { customerId: req.user.id } 
            : { branchId: req.user.branchId };

        const invoices = await Invoice.find(query).sort({ createdAt: -1 });
        return sendResponse(res, 200, true, "Invoices retrieved", invoices);
    } catch (error) {
        next(error);
    }
};

// Download PDF
export const downloadInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const branch = await Branch.findById(invoice.branchId);

        const doc = generateInvoicePDF(invoice, branch);

        // Set response headers to trigger a download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);

        doc.pipe(res);
    } catch (error) {
        next(error);
    }
};