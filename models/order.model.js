import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

// 6-character uppercase alphanumeric ID (Easy for customers to read over the phone)
const generateShortId = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        default: () => `ORD-${generateShortId()}`
    },
    // Relationships
    customerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    branchId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Branch', 
        required: true 
    },
    assignedEmployee: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },

    // Denormalized Customer Info (Fast lookup without population)
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },

    items: [{
        itemType: { type: String, required: true }, // e.g., "Shirt", "Duvet", "Suit"
        quantity: { type: Number, min: 1, required: true },
        unitPrice: { type: Number, min: 0, required: true },
        serviceType: { 
            type: String, 
            enum: ['WASH_FOLD', 'IRONING', 'DRY_CLEANING', 'STAIN_REMOVAL', 'ALTERATIONS'],
            default: 'WASH_FOLD'
        },
        specialInstructions: String,
        subtotal: { type: Number, default: 0 }
    }],

    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'WASHING', 'IRONING', 'READY', 'DELIVERED', 'CANCELLED'],
        default: 'PENDING'
    },

    // Tracking history of status changes
    statusHistory: [{
        status: String,
        updatedAt: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],

    priority: { 
        type: String, 
        enum: ['NORMAL', 'EXPRESS', 'URGENT'], 
        default: 'NORMAL' 
    },

    pickupDate: { type: Date },
    deliveryDate: { type: Date },

    // Financials
    paymentMethod: { 
        type: String, 
        enum: ['CASH', 'POS', 'TRANSFER', 'WALLET'], 
        default: 'CASH' 
    },
    paymentStatus: { 
        type: String, 
        enum: ['UNPAID', 'PARTIAL', 'PAID'], 
        default: 'UNPAID' 
    },
    
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 }, // Sum of items * priority
    totalAmount: { type: Number, required: true }, 
    
    notes: { type: String },
}, { timestamps: true });

// INDEXES for high-performance searching
orderSchema.index({ branchId: 1, status: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

/**
 * MIDDLEWARE: Automatic Price Calculation
 * Only runs on .save() to ensure data consistency
 */
orderSchema.pre('save', function (next) {
    // Only recalculate if price-impacting fields change
    if (this.isModified('items') || this.isModified('priority') || this.isModified('discount')) {
        let itemsTotal = 0;

        // Calculate individual item subtotals
        this.items.forEach(item => {
            item.subtotal = (item.quantity || 0) * (item.unitPrice || 0);
            itemsTotal += item.subtotal;
        });

        // Apply Priority Multipliers
        const multipliers = { 'URGENT': 1.5, 'EXPRESS': 1.25, 'NORMAL': 1 };
        const multiplier = multipliers[this.priority] || 1;
        
        this.subtotal = itemsTotal * multiplier;
        
        // Calculate Tax (e.g., 7.5%)
        this.tax = Math.round((this.subtotal * 0.075) * 100) / 100;

        // 4. Final Total
        const final = (this.subtotal + this.tax) - this.discount;
        this.totalAmount = Math.max(0, Math.round(final * 100) / 100);
    }

    // 5. Track Status History automatically on change
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            updatedAt: new Date()
        });
    }

    next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;