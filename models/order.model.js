import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const generateShortId = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: () => `ORD-${generateShortId()}`
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  items: [{
    itemType: { type: String, required: true },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    specialInstructions: String,
    subtotal: Number
  }],

  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'WASHING', 'IRONING', 'READY', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },

  priority: { 
    type: String, 
    enum: ['NORMAL', 'EXPRESS', 'URGENT'], 
    default: 'NORMAL' 
  },

  pickupDate: { type: Date },
  deliveryDate: { type: Date },

  paymentMethod: { type: String, default: 'CASH' },
  paymentStatus: { type: String, enum: ['UNPAID', 'PARTIAL', 'PAID'], default: 'UNPAID' },
  
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true }, 
  
  assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
}, { timestamps: true });

// Middleware for automatic price calculation
orderSchema.pre('validate', function (next) {
    const isUpdate = this.constructor.name === 'Query';
    const update = isUpdate ? this.getUpdate() : this;

    if (update.items && Array.isArray(update.items)) {
        let itemsSubtotal = 0;

        update.items.forEach(item => {
            item.subtotal = (item.quantity || 0) * (item.unitPrice || 0);
            itemsSubtotal += item.subtotal;
        });

        let priorityMultiplier = update.priority === 'URGENT' ? 1.5 : update.priority === 'EXPRESS' ? 1.25 : 1;
        const subtotalWithPriority = itemsSubtotal * priorityMultiplier;
        const tax = subtotalWithPriority * 0.08;
        const finalTotal = Math.round((subtotalWithPriority + tax - (update.discount || 0)) * 100) / 100;

        if (isUpdate) {
            this.getUpdate().subtotal = subtotalWithPriority;
            this.getUpdate().tax = tax;
            this.getUpdate().totalAmount = finalTotal;
        } else {
            this.subtotal = subtotalWithPriority;
            this.tax = tax;
            this.totalAmount = finalTotal;
        }
    }
    next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;