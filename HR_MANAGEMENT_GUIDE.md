# HR Management System - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Business Logic](#business-logic)
6. [Workflows](#workflows)
7. [Configuration & Customization](#configuration--customization)
8. [Best Practices](#best-practices)

---

## Overview

The HR Management System is a comprehensive solution for managing employee lifecycle, payroll, leave, and attendance tracking. It includes:

- **Employee Management**: Complete employee records with employment history
- **Payroll Processing**: Automated salary calculations with tax deductions
- **Leave Management**: Request/approval workflow with balance tracking
- **Attendance System**: Digital check-in/out and manual entry with summary reports
- **Salary Structure Configuration**: Role-based salary templates

### Key Features

✅ Role-based access control (SUPER_ADMIN, BRANCH_MANAGER, EMPLOYEE)
✅ Automated salary calculations with daily rates and deductions
✅ Leave request approval workflow
✅ Digital attendance tracking with device/IP logging
✅ Batch payroll processing for entire branches
✅ Comprehensive audit trails
✅ Payment transaction tracking
✅ Monthly summary reports and analytics

---

## System Architecture

### Models Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HR Management System                      │
└─────────────────────────────────────────────────────────────┘
       │
       ├── Employee (Core)
       │   ├── User Reference
       │   ├── Employment History
       │   ├── Bank Details
       │   └── Tax Information
       │
       ├── SalaryStructure (Configuration)
       │   ├── Components (Salary, Allowances)
       │   ├── Deductions (PF, Tax, Insurance)
       │   └── Leave Configuration
       │
       ├── Payroll (Processing)
       │   ├── Attendance Data
       │   ├── Earnings Calculation
       │   ├── Deductions Application
       │   └── Payment Tracking
       │
       ├── Leave (Workflow)
       │   ├── LeaveType (Categories)
       │   ├── Request Status
       │   ├── Approval Chain
       │   └── Balance Tracking
       │
       └── Attendance (Tracking)
           ├── Daily Records
           ├── Check-in/Check-out
           ├── Working Hours
           └── Approval Workflow
```

### Data Flow

```
Employee Created
    ↓
Assigned to SalaryStructure
    ↓
Monthly Payroll Processing
    ├→ Fetch Attendance Data
    ├→ Calculate Daily Rate
    ├→ Apply Deductions
    └→ Generate Salary Slip
    ↓
Approval & Payment
    └→ Mark as Paid (Transaction Tracking)

Leave Request
    ↓
Approval Workflow
    ├→ Pending
    ├→ Approved/Rejected
    └→ Completed
    ↓
Balance Updated

Daily Attendance
    ├→ Manual Entry or Digital Check-in/out
    ├→ Working Hours Auto-calculated
    ├→ Manager Approval
    └→ Used in Payroll Calculation
```

---

## Data Models

### 1. Employee Model

**Purpose**: Central employee record with complete personnel data

```javascript
{
  userId,                    // Reference to User model
  employeeNumber,           // Auto-generated: EMP2026XXXXX
  
  // Personal Information
  firstName, lastName,
  dateOfBirth,
  phone,
  email,
  gender,
  address, city, state, pincode,
  
  // Employment Information
  designation,              // Job title
  department,               // Department assignment
  branchId,                // Branch reference
  joinDate,
  reportingManagerId,       // Manager reference (Employee)
  status,                  // ACTIVE, INACTIVE, TERMINATED
  employmentType,          // FULL_TIME, PART_TIME, CONTRACT
  
  // Employment History
  employmentHistory: [{
    designation,
    department,
    startDate,
    endDate,
    promotionReason
  }],
  
  // Financial Information
  bankAccountNumber,
  bankName,
  ifscCode,
  panNumber,
  aadharNumber,
  
  // Termination
  terminationDate,
  terminationReason,
  exitNotes,
  
  timestamps
}
```

**Key Indexes**:
- employeeNumber (UNIQUE)
- branchId, userId, status
- reportingManagerId (for manager queries)

**Auto-calculated Fields**:
- employeeNumber: Generated on creation (EMP2026 + 5-digit number)

### 2. SalaryStructure Model

**Purpose**: Configurable salary templates for roles/branches

```javascript
{
  name,                     // "Senior Manager", "Assistant", etc.
  branchId,
  baseSalary,
  
  // Allowances (Monthly)
  allowances: {
    hra,                    // House Rent Allowance
    conveyance,             // Transport Allowance
    dearness,               // Dearness Allowance
    bonus,                  // Annual Bonus (monthly component)
    specialAllowance
  },
  
  // Deductions (as percentages)
  deductions: {
    providentFund: 12,      // PF percentage
    insurance: 2,           // Health insurance %
    incomeTax: 5,          // Tax deduction %
    professionalTax: 0.5   // Professional tax %
  },
  
  // Leave Configuration
  leaveConfiguration: {
    annualLeaves: 20,
    sickLeaves: 8,
    casualLeaves: 10
  },
  
  // Working Parameters
  workingDaysPerMonth: 22,
  hoursPerDay: 8,
  
  isActive,
  createdBy, updatedBy,
  timestamps
}
```

**Helper Methods**:
```javascript
calculateGrossSalary()      // Returns base + all allowances
calculateTotalDeductions()  // Returns sum of all deduction percentages
calculateNetSalary()        // Returns gross - deductions
```

### 3. Payroll Model

**Purpose**: Monthly salary processing and payment records

```javascript
{
  employeeId,
  payrollMonth,             // "2024-01" format
  
  // Attendance Data
  attendance: {
    workingDays: 22,
    attendedDays: 20,
    leavesTaken: 2,
    absentDays: 0,
    overtimeHours: 5
  },
  
  // Earnings
  earnings: {
    baseSalary,
    allowances: {
      hra, conveyance, dearness, bonus, special
    },
    overtime,
    bonus,
    grossSalary
  },
  
  // Deductions
  deductions: {
    providentFund,
    incomeTax,
    insurance,
    professionalTax,
    totalDeductions
  },
  
  // Final Amounts
  netSalary,
  
  // Processing Status
  status,                   // PENDING, PROCESSED, PAID, CANCELLED
  processedDate,
  processedBy,              // User ID
  approvedDate,
  approvedBy,
  
  // Payment Details
  paymentMethod,            // BANK_TRANSFER, CASH, CHEQUE
  paymentDate,
  transactionId,
  remarks,
  
  timestamps
}
```

**Unique Index**: employeeId + payrollMonth (prevent duplicates)

**Status Workflow**:
- PENDING → PROCESSED → PAID
- Any status can → CANCELLED

### 4. LeaveType Model

**Purpose**: Define leave categories and rules

```javascript
{
  name,                     // "Annual Leave", "Sick Leave", etc.
  branchId,
  description,
  
  // Configuration
  annualLimit,              // Days per year
  requiresApproval,         // true/false
  isUnpaid,                // false = paid leave
  
  // Rules
  maxConsecutiveDays,       // Max consecutive days allowed
  carryForwardDays,         // Days that can carry to next year
  encashable,               // Can unused days be paid out?
  
  // UI Properties
  color,                    // For calendar display
  icon,                     // Icon identifier
  
  isActive,
  timestamps
}
```

### 5. Leave Model

**Purpose**: Leave request workflow and tracking

```javascript
{
  employeeId,
  leaveTypeId,
  
  // Dates
  startDate,
  endDate,
  numberOfDays,             // Auto-calculated from date range
  
  // Details
  reason,
  status,                   // PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED
  halfDay,                  // true/false
  halfDayPeriod,           // MORNING, AFTERNOON (if halfDay=true)
  
  // Approval Chain
  approverComments,
  approvedDate,
  approvedBy,               // User ID of approver
  rejectionReason,
  
  attachments: [{
    fileName,
    fileUrl
  }],
  
  timestamps
}
```

**Auto-calculated Fields**:
- numberOfDays: Calculated from startDate and endDate

**Status Workflow**:
```
PENDING
  ├→ APPROVED → COMPLETED
  ├→ REJECTED
  └→ CANCELLED
```

### 6. Attendance Model

**Purpose**: Daily attendance and time tracking

```javascript
{
  employeeId,
  date,                     // YYYY-MM-DD format
  
  // Status
  status,                   // PRESENT, ABSENT, HALF_DAY, LEAVE, HOLIDAY, WEEKEND
  
  // Time Tracking
  checkInTime,             // HH:MM:SS format
  checkOutTime,
  workingHours,             // Auto-calculated
  overtimeHours,            // Hours beyond normal 8 hours
  
  // Leave Reference
  leaveId,                  // If marked with LEAVE status
  halfDayPeriod,           // MORNING, AFTERNOON
  
  // Device Tracking
  deviceId,                 // Mobile/device identifier
  ipAddress,
  checkInDevice,
  checkOutDevice,
  
  // Approval
  approvalStatus,           // PENDING, APPROVED, REJECTED
  approvedBy,
  approvedDate,
  managerNotes,
  
  isApproved,
  timestamps
}
```

**Unique Index**: employeeId + date (one record per day)

**Auto-calculated Fields**:
- workingHours: (checkOutTime - checkInTime)
- overtimeHours: if workingHours > 8

**Status Rules**:
- PRESENT: Requires checkIn/checkOut or manual entry
- ABSENT: No time entries
- LEAVE: linked to valid leaveId
- HALF_DAY: One check in/out period with period selection
- HOLIDAY/WEEKEND: System-set, not editable by employee

---

## API Endpoints

### Employee Management (`/api/v1/employees`)

#### Create Employee
```
POST /api/v1/employees
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER

Request Body:
{
  userId,              // Required
  designation,         // Required
  department,          // Required
  branchId,            // Required
  joinDate,            // Required
  reportingManagerId,
  firstName, lastName,
  phone, email,
  dateOfBirth,
  gender,
  address, city, state, pincode,
  bankAccountNumber,
  bankName,
  ifscCode,
  panNumber,
  aadharNumber,
  employmentType       // FULL_TIME, PART_TIME, CONTRACT
}

Response:
{
  success: true,
  message: "Employee created successfully",
  data: {
    employeeId,
    employeeNumber,
    ...employeeData
  }
}
```

#### Get All Employees
```
GET /api/v1/employees?page=1&limit=10&status=ACTIVE&branchId={id}
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    employees: [...],
    pagination: {
      total,
      pages,
      currentPage,
      hasNext
    }
  }
}
```

#### Get Employee by ID
```
GET /api/v1/employees/:employeeId
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    employeeId,
    employeeNumber,
    userId (populated),
    reportingManager (populated),
    branchId (populated),
    ...allEmployeeData
  }
}
```

#### Get Employee by User ID
```
GET /api/v1/employees/user/:userId
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {...employeeData}
}
```

#### Update Employee
```
PUT /api/v1/employees/:employeeId
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER (own branch only)

Request Body:
{
  designation,
  department,
  phone, email,
  // Protected fields: employeeNumber, userId, joinDate, employmentType
}

Response:
{
  success: true,
  message: "Employee updated successfully",
  data: {...updatedEmployee}
}
```

#### Terminate Employee
```
POST /api/v1/employees/:employeeId/terminate
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Request Body:
{
  terminationDate,     // Required
  terminationReason,   // Required
  exitNotes            // Optional
}

Response:
{
  success: true,
  message: "Employee terminated successfully",
  data: {...employeeData}
}
```

#### Delete Employee
```
DELETE /api/v1/employees/:employeeId
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Response:
{
  success: true,
  message: "Employee deleted successfully"
}
```

---

### Payroll Management (`/api/v1/payroll`)

#### Create Salary Structure
```
POST /api/v1/payroll/structure/create
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Request Body:
{
  name,              // "Senior Manager", etc.
  branchId,
  baseSalary,
  allowances: {
    hra, conveyance, dearness, bonus, specialAllowance
  },
  deductions: {
    providentFund: 12,
    insurance: 2,
    incomeTax: 5,
    professionalTax: 0.5
  },
  leaveConfiguration: {
    annualLeaves: 20,
    sickLeaves: 8,
    casualLeaves: 10
  },
  workingDaysPerMonth: 22,
  hoursPerDay: 8
}

Response:
{
  success: true,
  message: "Salary structure created",
  data: {structureId, ...structureData}
}
```

#### Get Salary Structures
```
GET /api/v1/payroll/structure/list?isActive=true&branchId={id}
Authorization: Bearer {token}

Response:
{
  success: true,
  data: [...structures]
}
```

#### Update Salary Structure
```
PUT /api/v1/payroll/structure/:structureId
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Request Body:
{
  baseSalary,
  allowances,
  deductions,
  ...otherFields
}

Response:
{
  success: true,
  message: "Salary structure updated",
  data: {...updatedStructure}
}
```

#### Process Payroll (Single Employee)
```
POST /api/v1/payroll/process
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER

Request Body:
{
  employeeId,        // Required
  payrollMonth       // "2024-01" format
}

Response:
{
  success: true,
  message: "Payroll processed successfully",
  data: {
    payrollId,
    employeeId,
    payrollMonth,
    grossSalary,
    netSalary,
    earnings: {...},
    deductions: {...},
    status: "PROCESSED"
  }
}
```

#### Process Payroll (Entire Branch)
```
POST /api/v1/payroll/process-branch
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Request Body:
{
  branchId,          // Required
  payrollMonth       // "2024-01" format
}

Response:
{
  success: true,
  message: "Payroll processed for branch",
  data: {
    processedCount: 45,
    failedCount: 2,
    totalAmount: 450000,
    details: [{...payrollData}, ...]
  }
}
```

#### Get Payrolls
```
GET /api/v1/payroll/list?employeeId={id}&month=2024-01&status=PAID&page=1
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    payrolls: [...],
    pagination: {...}
  }
}
```

#### Get Single Payroll
```
GET /api/v1/payroll/:payrollId
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    payrollId,
    employeeId (populated),
    ...allPayrollData
  }
}
```

#### Approve Payroll
```
PUT /api/v1/payroll/:payrollId/approve
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Response:
{
  success: true,
  message: "Payroll approved",
  data: {...payrollData}
}
```

#### Mark as Paid
```
PUT /api/v1/payroll/:payrollId/mark-paid
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Request Body:
{
  paymentMethod,     // BANK_TRANSFER, CASH, CHEQUE
  transactionId,     // For bank transfers
  remarks            // Optional notes
}

Response:
{
  success: true,
  message: "Payroll marked as paid",
  data: {...payrollData}
}
```

#### Generate Salary Slip
```
GET /api/v1/payroll/:payrollId/salary-slip
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    slip: {
      employeeName,
      employeeNumber,
      period,
      salaryBreakdown: {
        baseSalary,
        allowances: {...},
        grossSalary,
        deductions: {...},
        netSalary
      },
      bankDetails,
      generatedDate
    }
  }
}
```

---

### Leave Management (`/api/v1/leaves`)

#### Create Leave Type
```
POST /api/v1/leaves/type/create
Authorization: Bearer {token}
Roles: SUPER_ADMIN

Request Body:
{
  name,              // "Annual Leave", etc.
  branchId,
  annualLimit: 20,
  requiresApproval: true,
  isUnpaid: false,
  maxConsecutiveDays: 5,
  carryForwardDays: 5,
  encashable: true,
  color: "#FF5733",
  icon: "leaf"
}

Response:
{
  success: true,
  message: "Leave type created",
  data: {leaveTypeId, ...leaveTypeData}
}
```

#### Get Leave Types
```
GET /api/v1/leaves/type/list?branchId={id}&isActive=true
Authorization: Bearer {token}

Response:
{
  success: true,
  data: [...leaveTypes]
}
```

#### Request Leave
```
POST /api/v1/leaves/request
Authorization: Bearer {token}
Roles: All authenticated users

Request Body:
{
  leaveTypeId,       // Required
  startDate,         // YYYY-MM-DD
  endDate,           // YYYY-MM-DD
  reason,            // Required
  halfDay: false,
  halfDayPeriod,     // MORNING or AFTERNOON (if halfDay=true)
  attachments: []    // Optional file URLs
}

Response:
{
  success: true,
  message: "Leave request submitted",
  data: {
    leaveId,
    status: "PENDING",
    numberOfDays,
    ...leaveData
  }
}
```

#### Get Leave Requests
```
GET /api/v1/leaves/list?employeeId={id}&status=PENDING&startDate=2024-01-01&page=1
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    leaves: [...],
    pagination: {...}
  }
}
```

#### Get Single Leave Request
```
GET /api/v1/leaves/:leaveId
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    leaveId,
    employeeId (populated),
    leaveTypeId (populated),
    approvedBy (populated if approved),
    ...leaveData
  }
}
```

#### Approve Leave Request
```
PUT /api/v1/leaves/:leaveId/approve
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER

Request Body:
{
  approverComments: "Approved" // Optional
}

Response:
{
  success: true,
  message: "Leave request approved",
  data: {...leaveData}
}
```

#### Reject Leave Request
```
PUT /api/v1/leaves/:leaveId/reject
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER

Request Body:
{
  rejectionReason: "Required on that date" // Required
}

Response:
{
  success: true,
  message: "Leave request rejected",
  data: {...leaveData}
}
```

#### Cancel Leave Request
```
PUT /api/v1/leaves/:leaveId/cancel
Authorization: Bearer {token}

Request Body:
{
  cancellationReason: "Personal reasons" // Optional
}

Response:
{
  success: true,
  message: "Leave request cancelled",
  data: {...leaveData}
}
```

#### Get Leave Balance
```
GET /api/v1/leaves/balance/:employeeId
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    employeeId,
    currentYear: 2024,
    leaveBalances: [
      {
        leaveTypeName: "Annual Leave",
        totalAllowed: 20,
        taken: 5,
        remaining: 15,
        carryForward: 2
      },
      ...
    ]
  }
}
```

---

### Attendance Management (`/api/v1/attendance`)

#### Mark Attendance
```
POST /api/v1/attendance/mark
Authorization: Bearer {token}

Request Body:
{
  employeeId,        // Required
  date,              // YYYY-MM-DD
  status,            // PRESENT, ABSENT, HALF_DAY, LEAVE
  checkInTime,       // HH:MM:SS (optional for manual)
  checkOutTime,      // HH:MM:SS (optional for manual)
  leaveId,           // If status is LEAVE
  halfDayPeriod,     // MORNING/AFTERNOON (if HALF_DAY)
  remarks            // Optional
}

Response:
{
  success: true,
  message: "Attendance marked successfully",
  data: {
    attendanceId,
    date,
    status,
    workingHours,
    ...attendanceData
  }
}
```

#### Update Attendance
```
PUT /api/v1/attendance/:attendanceId
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER

Request Body:
{
  status,
  checkInTime,
  checkOutTime,
  remarks
  // Cannot change: employeeId, date
}

Response:
{
  success: true,
  message: "Attendance updated",
  data: {...updatedAttendance}
}
```

#### Get Attendance Records
```
GET /api/v1/attendance/list?employeeId={id}&month=2024-01&status=PRESENT&page=1
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    attendances: [...],
    pagination: {...}
  }
}
```

#### Get Single Attendance Record
```
GET /api/v1/attendance/:attendanceId
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {...attendanceData}
}
```

#### Digital Check-In
```
POST /api/v1/attendance/checkin
Authorization: Bearer {token}

Request Body:
{
  deviceId,          // Mobile device ID
  ipAddress          // Client IP
}

Response:
{
  success: true,
  message: "Checked in successfully",
  data: {
    attendanceId,
    checkInTime: "09:30:45",
    date: "2024-01-15"
  }
}
```

#### Digital Check-Out
```
POST /api/v1/attendance/checkout
Authorization: Bearer {token}

Request Body:
{
  deviceId,
  ipAddress
}

Response:
{
  success: true,
  message: "Checked out successfully",
  data: {
    attendanceId,
    checkOutTime: "17:45:30",
    workingHours: 8.25,
    date: "2024-01-15"
  }
}
```

#### Get Attendance Summary
```
GET /api/v1/attendance/summary/:employeeId?month=2024-01
Authorization: Bearer {token}

Response:
{
  success: true,
  data: {
    employeeId,
    month: "2024-01",
    totalWorkingDays: 22,
    presentDays: 20,
    absentDays: 1,
    halfDays: 1,
    leaveDays: 0,
    averageWorkingHours: 8.2,
    totalOvertimeHours: 12
  }
}
```

#### Approve Attendance
```
PUT /api/v1/attendance/:attendanceId/approve
Authorization: Bearer {token}
Roles: SUPER_ADMIN, BRANCH_MANAGER

Request Body:
{
  managerNotes: "Approved" // Optional
}

Response:
{
  success: true,
  message: "Attendance approved",
  data: {...attendanceData}
}
```

---

## Business Logic

### Salary Calculation Algorithm

```javascript
// Step 1: Fetch attendance data for the month
const attendance = await Attendance.find({
  employeeId,
  date: { $gte: startDate, $lte: endDate }
});

// Step 2: Get salary structure
const salaryStructure = await SalaryStructure.findById(employeeId.salaryStructureId);

// Step 3: Calculate working days
const workingDays = salaryStructure.workingDaysPerMonth;
const attendedDays = attendance.filter(a => a.status === 'PRESENT').length;
const halfDays = attendance.filter(a => a.status === 'HALF_DAY').length;
const leavesTaken = attendance.filter(a => a.status === 'LEAVE').length;

const effectiveWorkingDays = attendedDays + (halfDays * 0.5) - leavesTaken;

// Step 4: Calculate daily rate
const dailyRate = salaryStructure.baseSalary / workingDays;

// Step 5: Calculate earnings
const baseSalary = dailyRate * effectiveWorkingDays;
const allowances = calculateAllowances(salaryStructure);
const overtimeBonus = calculateOvertime(attendance, salaryStructure);
const grossSalary = baseSalary + allowances + overtimeBonus;

// Step 6: Calculate deductions
const providentFund = grossSalary * (salaryStructure.deductions.providentFund / 100);
const incomeTax = grossSalary * (salaryStructure.deductions.incomeTax / 100);
const insurance = grossSalary * (salaryStructure.deductions.insurance / 100);
const professionalTax = salaryStructure.deductions.professionalTax; // Fixed amount
const totalDeductions = providentFund + incomeTax + insurance + professionalTax;

// Step 7: Calculate net salary
const netSalary = grossSalary - totalDeductions;
```

### Leave Balance Calculation

```javascript
// Get current calendar year
const currentYear = new Date().getFullYear();
const startOfYear = new Date(currentYear, 0, 1);
const endOfYear = new Date(currentYear, 11, 31);

// Get leave type configuration
const leaveType = await LeaveType.findById(leaveTypeId);

// Get all approved leaves for current year
const approvedLeaves = await Leave.find({
  employeeId,
  leaveTypeId,
  status: 'APPROVED',
  startDate: { $gte: startOfYear, $lte: endOfYear }
});

// Calculate taken days
const takenDays = approvedLeaves.reduce((sum, leave) => sum + leave.numberOfDays, 0);

// Calculate remaining balance
const remainingBalance = leaveType.annualLimit - takenDays;
const availableBalance = Math.max(remainingBalance, 0);

return {
  totalAllowed: leaveType.annualLimit,
  taken: takenDays,
  remaining: availableBalance,
  carryForward: leaveType.carryForwardDays
};
```

### Attendance Working Hours Calculation

```javascript
// Calculate working hours from check-in and check-out times
const checkInTime = new Date(`2024-01-15T09:30:00`);
const checkOutTime = new Date(`2024-01-15T17:45:30`);

const workingMilliseconds = checkOutTime - checkInTime;
const workingHours = workingMilliseconds / (1000 * 60 * 60); // Convert to hours

// Check for overtime (assuming 8 hours is standard)
const standardHours = 8;
const overtimeHours = workingHours > standardHours ? workingHours - standardHours : 0;

// Overtime calculation (usually 1.5x for first 2 hours, 2x for beyond)
const dailyRate = (grossMonthlySalary / 22) / 8; // Per hour rate
let overtimeBonus = 0;
if (overtimeHours <= 2) {
  overtimeBonus = overtimeHours * dailyRate * 1.5;
} else {
  overtimeBonus = (2 * dailyRate * 1.5) + ((overtimeHours - 2) * dailyRate * 2);
}
```

---

## Workflows

### Employee Lifecycle

```
1. EMPLOYEE CREATION
   ├─ Create user account (User model)
   ├─ Create employee record (Employee model)
   └─ Assign salary structure

2. ACTIVE EMPLOYMENT
   ├─ Daily attendance marking
   ├─ Leave request submission
   ├─ Monthly payroll processing
   └─ Performance tracking

3. EMPLOYMENT CHANGES
   ├─ Promotion (update designation, new salary structure)
   ├─ Transfer (update branch, department)
   └─ Salary revision (update salary structure)

4. TERMINATION
   ├─ Set termination date and reason
   ├─ Calculate final settlement
   ├─ Transfer status to TERMINATED
   └─ Archive records
```

### Payroll Processing Workflow

```
START
  ↓
1. VALIDATION PHASE
   ├─ Check salary structure exists
   ├─ Check no duplicate payroll exists
   └─ Validate employee is ACTIVE
  ↓
2. DATA COLLECTION
   ├─ Fetch attendance records for month
   ├─ Get approved leave records
   └─ Retrieve salary structure
  ↓
3. CALCULATION PHASE
   ├─ Calculate working days
   ├─ Calculate daily rate
   ├─ Apply deductions
   ├─ Calculate overtime
   └─ Generate final salary slip
  ↓
4. RECORD CREATION
   ├─ Create payroll record (status: PROCESSED)
   ├─ Store all calculation details
   └─ Assign processedBy and date
  ↓
5. APPROVAL PHASE
   ├─ Manager/Admin reviews
   └─ Change status to APPROVED
  ↓
6. PAYMENT PHASE
   ├─ Payment method selection
   ├─ Transaction ID recording
   ├─ Change status to PAID
   └─ Send salary slip to employee
  ↓
END
```

### Leave Request Workflow

```
EMPLOYEE SUBMITS
  ↓
1. VALIDATION
   ├─ Check date range validity
   ├─ Check no overlapping leaves
   ├─ Verify leave type exists
   └─ Check leave balance available
  ↓
2. REQUEST CREATION
   ├─ Create leave record
   ├─ Set status: PENDING
   └─ Auto-calculate numberOfDays
  ↓
3. APPROVAL PENDING
   ├─ Manager receives notification
   └─ Review with attachments
  ↓
4A. APPROVED PATH
   ├─ Manager approves
   ├─ Update status to APPROVED
   ├─ Notify employee
   └─ Deduct from leave balance (when completed)
  ↓
4B. REJECTED PATH
   ├─ Manager rejects with reason
   ├─ Update status to REJECTED
   └─ Notify employee with reason
  ↓
5. COMPLETION (Approved leaves only)
   ├─ On leave end date, mark COMPLETED
   └─ Automatically applied in payroll
  ↓
EMPLOYEE CAN CANCEL
   ├─ Only if status is PENDING or APPROVED
   └─ Status changes to CANCELLED
```

### Attendance Check-in/Check-out Workflow

```
EMPLOYEE ARRIVAL
  ↓
1. DIGITAL CHECK-IN
   ├─ POST /api/v1/attendance/checkin
   ├─ Record device ID and IP
   ├─ Create attendance record
   ├─ Set checkInTime = current time
   └─ Status = PRESENT (tentative)
  ↓
2. WORKING HOURS
   ├─ Employee works throughout day
   └─ No record updates needed
  ↓
3. EMPLOYEE DEPARTURE
   ├─ POST /api/v1/attendance/checkout
   ├─ Record checkOutTime = current time
   ├─ Auto-calculate workingHours
   ├─ Calculate overtimeHours (if > 8 hours)
   └─ Status remains PRESENT
  ↓
4. MANAGER APPROVAL (Optional)
   ├─ Manager reviews attendance records
   ├─ Approves or makes corrections
   └─ Marks as APPROVED
  ↓
5. PAYROLL INTEGRATION
   ├─ Payroll engine fetches attendance
   ├─ Calculates salary based on working hours
   └─ Applies deductions/overtime accordingly
  ↓
ALTERNATIVE: MANUAL MARKING
   ├─ POST /api/v1/attendance/mark
   ├─ Manager manually enters status
   ├─ Optional: Can include check times
   └─ Status can be ABSENT, HALF_DAY, LEAVE
```

---

## Configuration & Customization

### Adding New Leave Types

```javascript
// Create a new leave type for your organization
const newLeaveType = await LeaveType.create({
  name: "Maternity Leave",
  branchId: "branch123",
  annualLimit: 180,           // 6 months
  requiresApproval: true,
  isUnpaid: false,
  maxConsecutiveDays: 180,
  carryForwardDays: 0,        // Can't carry forward
  encashable: false,          // Can't be paid out
  color: "#FF69B4",
  icon: "pregnancy"
});
```

### Customizing Salary Structure

```javascript
// Create salary structure for a specific role/branch
const salaryStructure = await SalaryStructure.create({
  name: "Senior Developer - Bangalore",
  branchId: "branch_bangalore",
  baseSalary: 60000,
  
  allowances: {
    hra: 18000,              // 30% of base
    conveyance: 2000,        // Fixed transport
    dearness: 6000,          // 10% of base
    bonus: 5000,             // Monthly component
    specialAllowance: 1000
  },
  
  deductions: {
    providentFund: 12,       // 12% PF (employee contribution)
    insurance: 2,            // 2% health insurance
    incomeTax: 5,            // 5% estimated IT
    professionalTax: 200     // Fixed professional tax
  },
  
  leaveConfiguration: {
    annualLeaves: 20,        // 20 days per year
    sickLeaves: 8,           // 8 days per year
    casualLeaves: 10         // 10 days per year
  },
  
  workingDaysPerMonth: 22,   // Typical for India
  hoursPerDay: 8,
  isActive: true
});
```

### Batch Payroll Processing Example

```javascript
// Process payroll for entire branch for a specific month
const branchPayroll = await processPayrollForBranch(
  branchId = "branch_bangalore",
  payrollMonth = "2024-01",
  processedBy = "admin_user_id"
);

// Returns summary:
{
  processedCount: 45,        // 45 employees processed
  failedCount: 2,            // 2 had errors
  totalAmount: 2850000,      // Total salary payout
  details: [                 // Array of all payroll records
    {
      employeeId,
      employeeNumber,
      employeeName,
      netSalary,
      status: "PROCESSED",
      grossSalary,
      deductions: {...}
    },
    ...
  ]
}
```

---

## Best Practices

### 1. Data Integrity

✅ **Always validate before processing**
```javascript
// Before processing payroll, validate:
- Employee exists and is ACTIVE
- Salary structure is assigned
- No duplicate payroll exists for month
- Attendance records exist for calculation
```

✅ **Maintain audit trails**
```javascript
// Always track who did what and when
{
  processedBy: userId,
  processedDate: new Date(),
  approvedBy: userId,
  approvedDate: new Date()
}
```

✅ **Use unique indexes to prevent duplicates**
```javascript
// Payroll: One per employee per month
payroll.createIndex({ employeeId: 1, payrollMonth: 1 }, { unique: true });

// Attendance: One per employee per day
attendance.createIndex({ employeeId: 1, date: 1 }, { unique: true });
```

### 2. Leave Management

✅ **Validate date ranges**
```javascript
// Ensure:
- endDate > startDate
- startDate >= today
- No overlapping leave requests
- Leave balance available
```

✅ **Half-day configuration**
```javascript
// Half days should:
- Only be 0.5 days in numberOfDays calculation
- Have valid halfDayPeriod (MORNING or AFTERNOON)
- Not overlap with full-day leaves of same type
```

### 3. Attendance Tracking

✅ **Security measures**
```javascript
// Track device info for security:
- Device ID prevents spoofing
- IP address provides location info
- Timestamp prevents backdating
```

✅ **Working hours validation**
```javascript
// Ensure:
- checkOutTime > checkInTime
- Reasonable working hours (4-12 hours typically)
- Overtime calculation is accurate
```

### 4. Payroll Processing

✅ **Calculation accuracy**
```javascript
// Always:
- Use fixed-point arithmetic for money
- Round to 2 decimal places consistently
- Document all calculation components
- Save detailed breakdown in payroll record
```

✅ **Approval workflow**
```javascript
// Implement proper checks:
- Only SUPER_ADMIN can process initial payroll
- BRANCH_MANAGER can only process their branch
- Approval before payment
- Payment method validation
```

### 5. Reporting and Analytics

✅ **Generate meaningful reports**
```javascript
// Monthly summaries:
- Total payout by branch
- Average salary by designation
- Leave usage statistics
- Attendance patterns
- Overtime trends
```

✅ **Provide employee visibility**
```javascript
// Employees should see:
- Their salary slip (earnings + deductions breakdown)
- Leave balance (remaining days by type)
- Attendance record (daily check-in/out)
- Leave request status
```

### 6. Scalability

✅ **Index frequently queried fields**
```javascript
// Add indexes for:
- employeeId, branchId, status (filtering)
- date ranges (payroll month queries)
- approval fields (workflow queries)
```

✅ **Use aggregation pipelines for reports**
```javascript
// Instead of fetching all records, use MongoDB aggregation
// Example: Monthly attendance summary aggregation
db.attendance.aggregate([
  { $match: { employeeId, date: { $gte, $lte } } },
  { $group: {
      _id: '$status',
      count: { $sum: 1 }
    }
  }
])
```

### 7. Compliance & Legal

✅ **Tax calculations**
```javascript
// Ensure:
- Income tax follows local regulations
- Professional tax is correctly applied
- PF contributions are accurate
- ESI if applicable
```

✅ **Leave compliance**
```javascript
// Follow local labor laws:
- Minimum annual leave as per region
- Sick leave entitlements
- Maternity/paternity leave
- Carryforward rules
```

✅ **Payroll security**
```javascript
// Protect sensitive data:
- Don't log full bank account details
- Encrypt transaction IDs
- Limited access to payroll data
- Audit all payment modifications
```

---

## Troubleshooting

### Common Issues

**Q: Salary calculation includes leaves not in the month**
A: Check that leaves have `status: "APPROVED"` and dates fall within the payroll month range.

**Q: Leave request rejection doesn't notify employee**
A: Ensure notification service is configured and notification is triggered on status change.

**Q: Duplicate payroll records created**
A: The unique index `{employeeId, payrollMonth}` should prevent this. Check if index exists: `db.payrolls.getIndexes()`.

**Q: Check-out not working without check-in**
A: The system should validate that checkIn exists before allowing checkOut. Add this validation if missing.

**Q: Employee number not auto-generating**
A: Check the pre-save hook in Employee model is properly configured: `employeeNumber = "EMP2026" + random5digits()`.

---

## Support & Documentation

For additional questions or custom implementations:
- Check existing controller implementations for patterns
- Review model schema for field requirements
- Examine test cases for usage examples
- Follow RBAC patterns from other modules

**Last Updated**: 2024
**Version**: 1.0
