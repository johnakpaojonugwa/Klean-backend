import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

// Create a generator: Numbers & Uppercase letters, 6 characters long
const generateShortId = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

const orderSchema = new mongoose.Schema({
  // Now looks like: ORD-H7K2P9
  orderNumber: {
    type: String,
    unique: true,
    default: () => `ORD-${generateShortId()}`
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  items: [{
    serviceName: { type: String, required: true },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    subtotal: Number
  }],

  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'WASHING', 'DRYING', 'IRONING', 'READY', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },

  pickupDate: { type: Date },
  deliveryDate: { type: Date },
  dueDate: { type: Date },

  paymentStatus: { type: String, enum: ['UNPAID', 'PARTIAL', 'PAID'], default: 'UNPAID' },
  totalAmount: { type: Number, required: true },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
}, { timestamps: true });

orderSchema.index({ branchId: 1, status: 1, createdAt: -1 });
orderSchema.index({ pickupDate: 1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ paymentStatus: 1});

// Smart Middleware for both Create and Update
orderSchema.pre('validate', function (next) {
    // Check if this is a Query (Update) or a Document (Create)
    const isUpdate = this.constructor.name === 'Query';
    const update = isUpdate ? this.getUpdate() : this;

    // We only recalculate if 'items' are actually being changed/provided
    if (update.items && Array.isArray(update.items)) {
        let calculatedTotal = 0;

        update.items.forEach(item => {
            item.subtotal = (item.quantity || 0) * (item.unitPrice || 0);
            calculatedTotal += item.subtotal;
        });

        const finalTotal = Math.round(calculatedTotal * 100) / 100;

        if (isUpdate) {
            this.getUpdate().totalAmount = finalTotal;
        } else {
            this.totalAmount = finalTotal;
        }
    }
    next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;