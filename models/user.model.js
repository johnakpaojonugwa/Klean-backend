import mongoose from "mongoose";
import bcryptjs from "bcryptjs";

// User Schema
const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, trim: true, lowercase: true },
    phoneNumber: { type: String, unique: true, required: true, trim: true },    
    password: { type: String, required: true, select: false },
    role: {
        type: String,
        enum: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER'],
        default: 'CUSTOMER'
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: function () {
            return this.role !== 'CUSTOMER';
        }
    },

    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    avatar: String,
    lastLogin: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ passwordResetToken: 1 }); 
userSchema.index({ branchId: 1, role: 1 });

// Hash password only if modified (prevents double hashing)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return;
    try {
        const salt = await bcryptjs.genSalt(10);
        this.password = await bcryptjs.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcryptjs.compare(candidatePassword, this.password);
};

// Remove password from responses
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.passwordResetToken;
    return obj;
};


const User = mongoose.model("User", userSchema);

export default User;