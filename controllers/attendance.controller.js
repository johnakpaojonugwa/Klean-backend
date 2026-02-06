import Attendance from "../models/attendance.model.js";
import Employee from "../models/employee.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

// Mark Attendance
export const markAttendance = async (req, res, next) => {
    try {
        const { employeeId, date, status, checkInTime, checkOutTime, overtimeHours, remarks } = req.body;

        // Validation
        if (!employeeId || !date || !status) {
            return sendError(res, 400, "Employee ID, date, and status are required");
        }

        // Check employee exists
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        // Check if attendance already exists for this date
        const existingAttendance = await Attendance.findOne({
            employeeId,
            date: new Date(date)
        });

        if (existingAttendance) {
            return sendError(res, 409, "Attendance already marked for this date");
        }

        const attendance = await Attendance.create({
            employeeId,
            branchId: employee.branchId,
            date: new Date(date),
            status,
            checkInTime: checkInTime ? new Date(checkInTime) : null,
            checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
            overtimeHours: overtimeHours || 0,
            remarks
        });

        logger.info(`Attendance marked for employee ${employee.employeeNumber} on ${date}`);

        return sendResponse(res, 201, true, "Attendance marked", { attendance });
    } catch (error) {
        logger.error("Mark attendance error:", error.message);
        next(error);
    }
};

// Update Attendance
export const updateAttendance = async (req, res, next) => {
    try {
        const { attendanceId } = req.params;
        const updates = req.body;

        // Don't allow updating date and employeeId
        delete updates.date;
        delete updates.employeeId;

        const attendance = await Attendance.findByIdAndUpdate(
            attendanceId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!attendance) {
            return sendError(res, 404, "Attendance record not found");
        }

        logger.info(`Attendance updated: ${attendanceId}`);

        return sendResponse(res, 200, true, "Attendance updated", { attendance });
    } catch (error) {
        logger.error("Update attendance error:", error.message);
        next(error);
    }
};

// Get Attendance Records
export const getAttendance = async (req, res, next) => {
    try {
        const { employeeId, branchId, status, startDate, endDate, page = 1, limit = 10 } = req.query;

        let query = {};
        if (employeeId) query.employeeId = employeeId;
        if (branchId) query.branchId = branchId;
        if (status) query.status = status;

        // Date range filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const attendance = await Attendance.find(query)
            .populate('employeeId', 'employeeNumber fullname')
            .populate('leaveId', 'reason')
            .populate('approvedBy', 'fullname')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ date: -1 });

        const total = await Attendance.countDocuments(query);

        return sendResponse(res, 200, true, "Attendance records retrieved", {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            attendance
        });
    } catch (error) {
        logger.error("Get attendance error:", error.message);
        next(error);
    }
};

// Get Single Attendance
export const getSingleAttendance = async (req, res, next) => {
    try {
        const { attendanceId } = req.params;

        const attendance = await Attendance.findById(attendanceId)
            .populate('employeeId')
            .populate('leaveId')
            .populate('approvedBy', 'fullname');

        if (!attendance) {
            return sendError(res, 404, "Attendance record not found");
        }

        return sendResponse(res, 200, true, "Attendance retrieved", { attendance });
    } catch (error) {
        logger.error("Get single attendance error:", error.message);
        next(error);
    }
};

// Check In
export const checkIn = async (req, res, next) => {
    try {
        const { employeeId, ipAddress, deviceId } = req.body;

        if (!employeeId) {
            return sendError(res, 400, "Employee ID is required");
        }

        // Check employee exists
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if attendance already exists for today
        let attendance = await Attendance.findOne({
            employeeId,
            date: today
        });

        if (attendance) {
            // If attendance exists and already has check-in time, return error
            if (attendance.checkInTime) {
                return sendError(res, 400, "Check-in already recorded for today");
            }
            // Update with check-in time
            attendance.checkInTime = new Date();
            attendance.status = 'PRESENT';
            attendance.ipAddress = ipAddress;
            attendance.deviceId = deviceId;
        } else {
            // Create new attendance with check-in
            attendance = await Attendance.create({
                employeeId,
                branchId: employee.branchId,
                date: today,
                status: 'PRESENT',
                checkInTime: new Date(),
                ipAddress,
                deviceId
            });
        }

        await attendance.save();

        logger.info(`Check-in recorded for employee ${employee.employeeNumber}`);

        return sendResponse(res, 200, true, "Check-in recorded", { attendance });
    } catch (error) {
        logger.error("Check-in error:", error.message);
        next(error);
    }
};

// Check Out
export const checkOut = async (req, res, next) => {
    try {
        const { employeeId, ipAddress, deviceId } = req.body;

        if (!employeeId) {
            return sendError(res, 400, "Employee ID is required");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOne({
            employeeId,
            date: today
        });

        if (!attendance) {
            return sendError(res, 404, "Attendance record not found. Please check-in first");
        }

        if (attendance.checkOutTime) {
            return sendError(res, 400, "Check-out already recorded for today");
        }

        attendance.checkOutTime = new Date();
        attendance.ipAddress = ipAddress;
        attendance.deviceId = deviceId;

        await attendance.save();

        logger.info(`Check-out recorded for employee ${employeeId}`);

        return sendResponse(res, 200, true, "Check-out recorded", { attendance });
    } catch (error) {
        logger.error("Check-out error:", error.message);
        next(error);
    }
};

// Get Attendance Summary
export const getAttendanceSummary = async (req, res, next) => {
    try {
        const { employeeId, branchId, month } = req.query;

        let matchStage = {};
        if (employeeId) matchStage.employeeId = new mongoose.Types.ObjectId(employeeId);
        if (branchId) matchStage.branchId = new mongoose.Types.ObjectId(branchId);

        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = new Date(year, monthNum - 1, 1);
            const endDate = new Date(year, monthNum, 0);
            matchStage.date = { $gte: startDate, $lte: endDate };
        }

        const summary = await Attendance.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$employeeId',
                    totalDays: { $sum: 1 },
                    presentDays: {
                        $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] }
                    },
                    absentDays: {
                        $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] }
                    },
                    halfDays: {
                        $sum: { $cond: [{ $eq: ['$status', 'HALF_DAY'] }, 1, 0] }
                    },
                    leaveDays: {
                        $sum: { $cond: [{ $eq: ['$status', 'LEAVE'] }, 1, 0] }
                    },
                    totalOvertimeHours: { $sum: '$overtimeHours' }
                }
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'employee'
                }
            }
        ]);

        return sendResponse(res, 200, true, "Attendance summary retrieved", { summary });
    } catch (error) {
        logger.error("Get attendance summary error:", error.message);
        next(error);
    }
};

// Approve Attendance
export const approveAttendance = async (req, res, next) => {
    try {
        const { attendanceId } = req.params;

        const attendance = await Attendance.findByIdAndUpdate(
            attendanceId,
            {
                $set: {
                    approved: true,
                    approvedBy: req.user.id
                }
            },
            { new: true }
        );

        if (!attendance) {
            return sendError(res, 404, "Attendance record not found");
        }

        logger.info(`Attendance approved: ${attendanceId}`);

        return sendResponse(res, 200, true, "Attendance approved", { attendance });
    } catch (error) {
        logger.error("Approve attendance error:", error.message);
        next(error);
    }
};
