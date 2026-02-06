# Advanced Features Guide - Notifications, Analytics & Alerts

This guide covers the enterprise features added to Klean Backend: SMS/Email notifications, automated alerts, and comprehensive analytics dashboard.

---

## 📧 Email Notifications

### Setup
1. Configure SMTP credentials in `.env`:
```env
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password  # Use app-specific password for Gmail
```

2. For Gmail, enable 2-factor authentication and generate an [app-specific password](https://support.google.com/accounts/answer/185833)

### Email Types

#### Welcome Email
Sent automatically when user registers
```javascript
await emailService.sendWelcomeEmail(user);
```

#### Low-Stock Alerts
Sent daily at 8 AM to branch managers
```javascript
await emailService.sendLowStockAlert(items, email);
```

#### Order Status Updates
Sent when order status changes
```javascript
await emailService.sendOrderStatusEmail(order, user);
```

#### Password Reset
Sent when user requests password reset
```javascript
await emailService.sendPasswordResetEmail(user, resetToken);
```

---

## 📱 SMS Notifications

### Setup
1. Create [Twilio Account](https://www.twilio.com)
2. Configure credentials in `.env`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

3. Users must have a phone number field for SMS to work

### SMS Types

#### Welcome SMS
```javascript
await smsService.sendWelcomeSMS(phoneNumber, userName);
```

#### Low-Stock Alerts
```javascript
await smsService.sendLowStockAlertSMS(phoneNumber, itemCount);
```

#### Order Status
```javascript
await smsService.sendOrderStatusSMS(phoneNumber, orderNumber, status);
```

#### Payment Reminders
```javascript
await smsService.sendPaymentReminderSMS(phoneNumber, orderNumber, amount);
```

#### OTP
```javascript
await smsService.sendOTP(phoneNumber, otp);
```

---

## 🚨 Automated Low-Stock Alerts

### How It Works
1. **Scheduled Check**: Runs daily at 8:00 AM
2. **Detection**: Finds all inventory items below reorder level
3. **Notification**: Sends email + SMS to branch manager
4. **Tracking**: Records alerts in database

### Manual Trigger
```bash
POST /api/v1/notifications/low-stock/check
Authorization: Bearer <SUPER_ADMIN_TOKEN>
```

### API Endpoints

#### Get Low-Stock Alerts
```bash
GET /api/v1/notifications/low-stock/alerts?branchId=...&isResolved=false
Authorization: Bearer <TOKEN>
```

Response:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "_id": "...",
        "itemName": "Detergent Powder",
        "currentStock": 5,
        "reorderLevel": 20,
        "branch": "Downtown Branch",
        "alertsSent": 3,
        "isResolved": false,
        "alertSentAt": "2026-01-18T08:00:00Z"
      }
    ]
  }
}
```

#### Resolve Alert
```bash
PUT /api/v1/notifications/low-stock/alerts/:alertId/resolve
Authorization: Bearer <TOKEN>
```

---

## 📊 Analytics Dashboard

### Architecture
- **Real-time Dashboard**: Summary of today's metrics
- **Period Analytics**: Historical data analysis
- **Trending**: Visual trends over time
- **Daily Generation**: Automated daily analytics creation

### Dashboard Metrics
```bash
GET /api/v1/analytics/dashboard
Authorization: Bearer <TOKEN>
```

Returns:
```json
{
  "today": {
    "totalOrders": 45,
    "totalRevenue": 2250.00,
    "ordersCompleted": 35,
    "peakOrderHours": "9,12,17"
  },
  "week": {
    "totalOrders": 280,
    "totalRevenue": 14000.00,
    "newCustomers": 42,
    "averageOrdersPerDay": 40
  },
  "pending": 15,
  "lowStockItems": 5
}
```

### Period Analytics
```bash
GET /api/v1/analytics/period?startDate=2026-01-01&endDate=2026-01-18
Authorization: Bearer <TOKEN>
```

#### Data Includes:
- Daily order counts & values
- Revenue breakdown (paid/unpaid)
- Customer metrics
- Payment status breakdown
- Low-stock alerts
- Peak order hours

### Order Trends
```bash
GET /api/v1/analytics/orders/trends?startDate=2026-01-01&endDate=2026-01-18
Authorization: Bearer <TOKEN>
```

Returns:
```json
{
  "dailyOrders": [
    {
      "date": "2026-01-18T00:00:00Z",
      "orders": 45,
      "revenue": 2250.00
    }
  ],
  "statusBreakdown": {
    "RECEIVED": 5,
    "WASHING": 8,
    "DRYING": 7,
    "READY": 15,
    "DELIVERED": 35,
    "CANCELLED": 2
  }
}
```

### Revenue Analytics
```bash
GET /api/v1/analytics/revenue?startDate=2026-01-01&endDate=2026-01-18
Authorization: Bearer <TOKEN>
```

Returns:
```json
{
  "totalRevenue": 65000.00,
  "paidOrders": 250,
  "unpaidOrders": 18,
  "averageOrderValue": 260.00,
  "dailyRevenue": [...]
}
```

### Customer Analytics
```bash
GET /api/v1/analytics/customers?startDate=2026-01-01&endDate=2026-01-18
Authorization: Bearer <TOKEN>
```

Returns:
```json
{
  "totalNewCustomers": 125,
  "averageNewCustomersPerDay": 6.94,
  "growth": "8.5%",
  "newCustomersPerDay": [...]
}
```

### Daily Analytics
```bash
GET /api/v1/analytics/daily?date=2026-01-18
Authorization: Bearer <TOKEN>
```

---

## 📬 Notification Management

### Get User Notifications
```bash
GET /api/v1/notifications?page=1&limit=10&status=SENT&category=ORDER_UPDATE
Authorization: Bearer <TOKEN>
```

### Mark as Read
```bash
PUT /api/v1/notifications/:notificationId/read
Authorization: Bearer <TOKEN>
```

### Mark All as Read
```bash
PUT /api/v1/notifications/mark-all-read
Authorization: Bearer <TOKEN>
```

### Delete Notification
```bash
DELETE /api/v1/notifications/:notificationId
Authorization: Bearer <TOKEN>
```

### Notification Schema
```javascript
{
  userId: ObjectId,
  type: 'EMAIL' | 'SMS' | 'IN_APP',
  category: 'ORDER_UPDATE' | 'LOW_STOCK' | 'PAYMENT' | 'WELCOME' | 'ALERT',
  subject: String,
  message: String,
  recipient: String, // email or phone
  status: 'PENDING' | 'SENT' | 'FAILED',
  sentAt: Date,
  readAt: Date,
  isRead: Boolean,
  relatedOrderId: ObjectId
}
```

---

## ⏰ Scheduled Jobs

### Automatic Execution
Jobs run on schedule without manual intervention:

#### 1. Low-Stock Check
- **Time**: 8:00 AM daily
- **Action**: Checks inventory, sends alerts to branch managers
- **Configuration**: In `utils/scheduledJobs.js`

#### 2. Generate Daily Analytics
- **Time**: 11:59 PM daily
- **Action**: Processes all orders from the day, generates analytics
- **Stores**: Daily metrics in Analytics collection

#### 3. Payment Reminders
- **Time**: 5:00 PM daily
- **Action**: Sends SMS reminders for unpaid ready orders
- **Target**: All orders with status READY and paymentStatus !== PAID

#### 4. Cleanup Old Notifications
- **Time**: 2:00 AM every Sunday
- **Action**: Deletes notifications older than 30 days
- **Keeps**: Recent notifications for reference

### Customize Schedules
Edit `utils/scheduledJobs.js`:
```javascript
// Change time format: "minute hour day month weekday"
// 0 8 * * * = 8:00 AM every day
// 0 9 * * 1 = 9:00 AM every Monday
// */15 * * * * = Every 15 minutes

cron.schedule('0 8 * * *', async () => {
    // Your job
});
```

---

## 🔧 Integration Examples

### Send Notification on Order Created
```javascript
import { notificationService } from '../services/notificationService.js';

// In order controller
export const createOrder = async (req, res, next) => {
    try {
        const order = await Order.create(req.body);
        
        // Send notification
        await notificationService.sendOrderStatusNotification(order._id);
        
        return sendResponse(res, 201, true, "Order created", { order });
    } catch (error) {
        next(error);
    }
};
```

### Add Phone Field to Users
```javascript
// Update User model
const userSchema = new mongoose.Schema({
    // ... existing fields
    phone: { 
        type: String, 
        match: [/^\+?[0-9]{7,15}$/, "Invalid phone number"]
    }
});
```

### Track Notifications
```javascript
import Notification from '../models/notification.model.js';

// Find all failed notifications
const failed = await Notification.find({ status: 'FAILED' });

// Find unread notifications
const unread = await Notification.find({ isRead: false });

// Find by category
const orders = await Notification.find({ category: 'ORDER_UPDATE' });
```

---

## 📈 Analytics Examples

### Compare Performance
```bash
# Get January performance
GET /api/v1/analytics/period?startDate=2026-01-01&endDate=2026-01-31

# Get same month last year
GET /api/v1/analytics/period?startDate=2025-01-01&endDate=2025-01-31

# Compare revenue growth
growth = ((jan2026Revenue - jan2025Revenue) / jan2025Revenue) * 100
```

### Branch Performance
```bash
# Downtown Branch analytics
GET /api/v1/analytics/dashboard?branchId=60d5ec49c1234567890abcd1

# Compare branches
GET /api/v1/analytics/period?startDate=2026-01-01&endDate=2026-01-18&branchId=...
```

### Peak Hours Analysis
```javascript
// From analytics.peakOrderHours
// "9,12,17" means peak hours are 9 AM, 12 PM, 5 PM

// Use for:
// - Scheduling staff
// - Planning inventory
// - Resource allocation
```

---

## ⚙️ Troubleshooting

### Email Not Sending
1. Check `.env` credentials
2. Verify Gmail app-specific password (not regular password)
3. Check logs: `logs/error-YYYY-MM-DD.log`
4. Test transporter connection in initialization

### SMS Not Sending
1. Verify Twilio credentials
2. Check phone number format (with country code: +1234567890)
3. Verify Twilio account has credits
4. Check Twilio phone number is verified

### Low-Stock Alerts Not Triggering
1. Verify `node-cron` is installed
2. Check scheduled jobs initialization in server.js
3. Verify branch manager exists and has email/phone
4. Manual trigger: POST /api/v1/notifications/low-stock/check

### Analytics Not Generating
1. Verify MongoDB is connected
2. Check scheduled jobs in logs
3. Manual trigger: Create orders and check metrics
4. Check date/timezone settings

---

## 📚 Related Documentation
- [README.md](../README.md) - Project overview
- [API_TESTING_GUIDE.md](../API_TESTING_GUIDE.md) - API testing examples
- [CODE_REVIEW.md](../CODE_REVIEW.md) - Architecture details
