import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
    // References
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    
    // Date
    date: { type: Date, required: true },
    
    // Attendance Status
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND'],
        default: 'ABSENT'
    },
    
    // Time Information
    checkInTime: Date,
    checkOutTime: Date,
    workingHours: { type: Number, default: 0, min: 0 },
    
    // Leave Information (if on leave)
    leaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave' },
    leaveType: String,
    
    // Half Day Info
    isHalfDay: { type: Boolean, default: false },
    halfDayPeriod: {
        type: String,
        enum: ['MORNING', 'AFTERNOON']
    },
    
    // Overtime Information
    overtimeHours: { type: Number, default: 0, min: 0 },
    
    // Remarks
    remarks: String,
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Device Information (for automated check-in/out)
    deviceId: String,
    ipAddress: String,
    
}, { timestamps: true });

// Index for faster queries
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ branchId: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });

// Auto-calculate working hours if check times are provided
attendanceSchema.pre('save', function(next) {
    if (this.checkInTime && this.checkOutTime) {
        const timeDiff = this.checkOutTime - this.checkInTime;
        this.workingHours = timeDiff / (1000 * 3600); // Convert milliseconds to hours
    }
    next();
});

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
