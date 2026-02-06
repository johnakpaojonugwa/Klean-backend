# HR API Quick Reference

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication
All endpoints require: `Authorization: Bearer {JWT_TOKEN}`

---

## 👥 EMPLOYEE ENDPOINTS

### Create Employee
```bash
POST /employees
Content-Type: application/json
Authorization: Bearer {TOKEN}

{
  "userId": "640a1b3c2d4e5f6g7h8i9j0k",
  "designation": "Senior Developer",
  "department": "Technology",
  "branchId": "branch_123",
  "joinDate": "2024-01-15",
  "employmentType": "FULL_TIME",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "dateOfBirth": "1990-05-20",
  "gender": "MALE",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "pincode": "10001",
  "panNumber": "ABCDE1234F",
  "aadharNumber": "1234567890123456",
  "bankAccountNumber": "1234567890",
  "bankName": "State Bank",
  "ifscCode": "SBIN0001234"
}

Response: { success: true, data: { employeeId, employeeNumber, ... } }
```

### Get All Employees
```bash
GET /employees?page=1&limit=10&status=ACTIVE&branchId=branch_123

Response: { success: true, data: { employees: [...], pagination: {...} } }
```

### Get Employee by User ID
```bash
GET /employees/user/{userId}

Response: { success: true, data: {...employeeData} }
```

### Get Single Employee
```bash
GET /employees/{employeeId}

Response: { success: true, data: {...employeeData} }
```

### Update Employee
```bash
PUT /employees/{employeeId}

{
  "designation": "Lead Developer",
  "department": "Engineering",
  "phone": "+1234567891"
}

Response: { success: true, message: "Employee updated", data: {...} }
```

### Terminate Employee
```bash
POST /employees/{employeeId}/terminate

{
  "terminationDate": "2024-03-31",
  "terminationReason": "Resignation",
  "exitNotes": "Employee gave 2 weeks notice"
}

Response: { success: true, message: "Employee terminated", data: {...} }
```

### Delete Employee
```bash
DELETE /employees/{employeeId}

Response: { success: true, message: "Employee deleted" }
```

---

## 💰 PAYROLL ENDPOINTS

### Create Salary Structure
```bash
POST /payroll/structure/create

{
  "name": "Senior Developer - Bangalore",
  "branchId": "branch_bangalore",
  "baseSalary": 60000,
  "allowances": {
    "hra": 18000,
    "conveyance": 2000,
    "dearness": 6000,
    "bonus": 5000,
    "specialAllowance": 1000
  },
  "deductions": {
    "providentFund": 12,
    "insurance": 2,
    "incomeTax": 5,
    "professionalTax": 0.5
  },
  "leaveConfiguration": {
    "annualLeaves": 20,
    "sickLeaves": 8,
    "casualLeaves": 10
  },
  "workingDaysPerMonth": 22,
  "hoursPerDay": 8
}

Response: { success: true, data: { structureId, ...} }
```

### Get Salary Structures
```bash
GET /payroll/structure/list?isActive=true&branchId=branch_123

Response: { success: true, data: [...structures] }
```

### Update Salary Structure
```bash
PUT /payroll/structure/{structureId}

{
  "baseSalary": 65000,
  "allowances": {
    "hra": 19500
  }
}

Response: { success: true, data: {...} }
```

### Process Payroll (Single Employee)
```bash
POST /payroll/process

{
  "employeeId": "emp_123",
  "payrollMonth": "2024-01"
}

Response: { 
  success: true, 
  data: {
    payrollId,
    grossSalary: 95000,
    netSalary: 78500,
    deductions: { ... },
    status: "PROCESSED"
  }
}
```

### Process Payroll (Entire Branch)
```bash
POST /payroll/process-branch

{
  "branchId": "branch_123",
  "payrollMonth": "2024-01"
}

Response: {
  success: true,
  data: {
    processedCount: 45,
    failedCount: 0,
    totalAmount: 4275000
  }
}
```

### Get Payrolls (List)
```bash
GET /payroll/list?employeeId=emp_123&month=2024-01&status=PAID&page=1

Response: { success: true, data: { payrolls: [...], pagination: {...} } }
```

### Get Single Payroll
```bash
GET /payroll/{payrollId}

Response: { success: true, data: {...payrollData} }
```

### Approve Payroll
```bash
PUT /payroll/{payrollId}/approve

Response: { success: true, data: {...} }
```

### Mark Payroll as Paid
```bash
PUT /payroll/{payrollId}/mark-paid

{
  "paymentMethod": "BANK_TRANSFER",
  "transactionId": "TXN123456789",
  "remarks": "Paid to employee account"
}

Response: { success: true, data: {...} }
```

### Generate Salary Slip
```bash
GET /payroll/{payrollId}/salary-slip

Response: {
  success: true,
  data: {
    slip: {
      employeeName: "John Doe",
      employeeNumber: "EMP202400123",
      period: "January 2024",
      salaryBreakdown: {
        baseSalary: 60000,
        allowances: {...},
        grossSalary: 95000,
        deductions: {...},
        netSalary: 78500
      },
      bankDetails: {...},
      generatedDate: "2024-02-01"
    }
  }
}
```

---

## 🏖️ LEAVE ENDPOINTS

### Create Leave Type
```bash
POST /leaves/type/create

{
  "name": "Annual Leave",
  "branchId": "branch_123",
  "annualLimit": 20,
  "requiresApproval": true,
  "isUnpaid": false,
  "maxConsecutiveDays": 5,
  "carryForwardDays": 5,
  "encashable": true,
  "color": "#FF5733",
  "icon": "leaf"
}

Response: { success: true, data: { leaveTypeId, ... } }
```

### Get Leave Types
```bash
GET /leaves/type/list?branchId=branch_123&isActive=true

Response: { success: true, data: [...leaveTypes] }
```

### Request Leave
```bash
POST /leaves/request

{
  "leaveTypeId": "leave_type_123",
  "startDate": "2024-02-01",
  "endDate": "2024-02-03",
  "reason": "Personal work",
  "halfDay": false,
  "attachments": []
}

Response: {
  success: true,
  data: {
    leaveId: "leave_123",
    status: "PENDING",
    numberOfDays: 3,
    ...
  }
}
```

### Get Leave Requests
```bash
GET /leaves/list?employeeId=emp_123&status=PENDING&startDate=2024-01-01&page=1

Response: { success: true, data: { leaves: [...], pagination: {...} } }
```

### Get Single Leave Request
```bash
GET /leaves/{leaveId}

Response: { success: true, data: {...leaveData} }
```

### Approve Leave Request
```bash
PUT /leaves/{leaveId}/approve

{
  "approverComments": "Approved as per leave policy"
}

Response: { success: true, data: {...} }
```

### Reject Leave Request
```bash
PUT /leaves/{leaveId}/reject

{
  "rejectionReason": "Required during critical project phase"
}

Response: { success: true, data: {...} }
```

### Cancel Leave Request
```bash
PUT /leaves/{leaveId}/cancel

{
  "cancellationReason": "Personal reasons changed"
}

Response: { success: true, data: {...} }
```

### Get Leave Balance
```bash
GET /leaves/balance/{employeeId}

Response: {
  success: true,
  data: {
    employeeId: "emp_123",
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

## ⏰ ATTENDANCE ENDPOINTS

### Mark Attendance
```bash
POST /attendance/mark

{
  "employeeId": "emp_123",
  "date": "2024-01-15",
  "status": "PRESENT",
  "checkInTime": "09:00:00",
  "checkOutTime": "17:30:00",
  "remarks": "Regular day"
}

Response: {
  success: true,
  data: {
    attendanceId: "att_123",
    workingHours: 8.5,
    status: "PRESENT"
  }
}
```

### Update Attendance
```bash
PUT /attendance/{attendanceId}

{
  "status": "HALF_DAY",
  "checkInTime": "09:00:00",
  "checkOutTime": "13:00:00",
  "remarks": "Emergency leave in afternoon"
}

Response: { success: true, data: {...} }
```

### Get Attendance Records
```bash
GET /attendance/list?employeeId=emp_123&month=2024-01&status=PRESENT&page=1

Response: { success: true, data: { attendances: [...], pagination: {...} } }
```

### Get Single Attendance Record
```bash
GET /attendance/{attendanceId}

Response: { success: true, data: {...attendanceData} }
```

### Digital Check-In
```bash
POST /attendance/checkin

{
  "deviceId": "iphone_12_pro",
  "ipAddress": "192.168.1.100"
}

Response: {
  success: true,
  data: {
    attendanceId: "att_123",
    checkInTime: "09:15:30",
    date: "2024-01-15"
  }
}
```

### Digital Check-Out
```bash
POST /attendance/checkout

{
  "deviceId": "iphone_12_pro",
  "ipAddress": "192.168.1.100"
}

Response: {
  success: true,
  data: {
    attendanceId: "att_123",
    checkOutTime: "17:45:20",
    workingHours: 8.5,
    overtimeHours: 0.5
  }
}
```

### Get Attendance Summary
```bash
GET /attendance/summary/{employeeId}?month=2024-01

Response: {
  success: true,
  data: {
    employeeId: "emp_123",
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

### Approve Attendance
```bash
PUT /attendance/{attendanceId}/approve

{
  "managerNotes": "Approved. Regular attendance"
}

Response: { success: true, data: {...} }
```

---

## 🔐 Authorization Requirements

| Endpoint | Roles |
|----------|-------|
| POST /employees | SUPER_ADMIN, BRANCH_MANAGER |
| DELETE /employees | SUPER_ADMIN |
| POST /employees/:id/terminate | SUPER_ADMIN |
| POST /payroll/process | SUPER_ADMIN, BRANCH_MANAGER |
| POST /payroll/process-branch | SUPER_ADMIN |
| PUT /payroll/:id/approve | SUPER_ADMIN |
| PUT /payroll/:id/mark-paid | SUPER_ADMIN |
| PUT /leaves/:id/approve | SUPER_ADMIN, BRANCH_MANAGER |
| PUT /leaves/:id/reject | SUPER_ADMIN, BRANCH_MANAGER |
| PUT /attendance/:id/approve | SUPER_ADMIN, BRANCH_MANAGER |

---

## 📊 Status Values

### Employee Status
- ACTIVE
- INACTIVE
- ON_LEAVE
- TERMINATED
- SUSPENDED

### Payroll Status
- PENDING
- PROCESSED
- PAID
- CANCELLED

### Leave Status
- PENDING
- APPROVED
- REJECTED
- CANCELLED
- COMPLETED

### Attendance Status
- PRESENT
- ABSENT
- HALF_DAY
- LEAVE
- HOLIDAY
- WEEKEND

---

## 💡 Example Workflow

### 1. Create Employee
```bash
curl -X POST http://localhost:5000/api/v1/employees \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 2. Create Salary Structure
```bash
curl -X POST http://localhost:5000/api/v1/payroll/structure/create \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 3. Mark Attendance (Daily)
```bash
curl -X POST http://localhost:5000/api/v1/attendance/checkin \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 4. Request Leave
```bash
curl -X POST http://localhost:5000/api/v1/leaves/request \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 5. Process Monthly Payroll
```bash
curl -X POST http://localhost:5000/api/v1/payroll/process \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## ⚠️ Common Errors

| Code | Message | Solution |
|------|---------|----------|
| 400 | Employee does not have a salary structure assigned | Create salary structure and assign to employee |
| 400 | Payroll already exists for this month | Check existing payroll records |
| 400 | No overlapping leaves allowed | Verify leave dates don't conflict |
| 404 | Employee not found | Verify employee ID exists |
| 401 | Unauthorized | Add valid JWT token in Authorization header |
| 403 | Forbidden - insufficient permissions | Check user role for endpoint |

---

**API Version**: 1.0  
**Last Updated**: 2024  
**Status**: Production Ready ✅
