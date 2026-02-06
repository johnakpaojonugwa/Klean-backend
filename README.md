# Klean Backend - Modern Laundry Management System

A production-ready backend API for a multi-branch laundry management system built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Management**: RBAC (Role-Based Access Control) with 4 roles: SUPER_ADMIN, BRANCH_MANAGER, STAFF, CUSTOMER
- **Order Management**: Complete order lifecycle from creation to delivery
- **Inventory Management**: Track laundry supplies with low-stock alerts
- **Branch Management**: Multi-branch support with branch isolation
- **HR Management**: Complete employee lifecycle, payroll processing, leave management, attendance tracking
- **Email & SMS Notifications**: Automated notifications for orders, leaves, and system events
- **Analytics Dashboard**: Detailed insights and reporting
- **Security**: JWT authentication, rate limiting, helmet for security headers
- **Error Handling**: Global error handler with proper logging
- **Validation**: Comprehensive input validation and error responses
- **Database**: MongoDB with Mongoose ODM

## 📋 Prerequisites

- Node.js (v16+)
- npm or yarn
- MongoDB (local or Atlas)
- Cloudinary account (for file uploads)

## 🔧 Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd klean-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```

Fill in the required environment variables:
```env
MONGO_URI=mongodb://localhost:27017/klean-db
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret
PORT=3000
NODE_ENV=development
CLOUD_NAME=your_cloudinary_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
```

4. **Start the server**
```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📁 Project Structure

```
klean-backend/
├── config/               # Database and configuration files
├── controllers/          # Request handlers
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── order.controller.js
│   ├── branch.controller.js
│   └── inventory.controller.js
├── middlewares/          # Custom middleware
│   ├── authMiddleware.js
│   ├── errorHandler.js
│   ├── validationMiddleware.js
│   └── adminMiddleware.js
├── models/              # Mongoose schemas
│   ├── user.model.js
│   ├── order.model.js
│   ├── branch.model.js
│   └── inventory.model.js
├── routes/              # API routes
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── order.routes.js
│   ├── branch.routes.js
│   └── inventory.routes.js
├── utils/               # Helper functions
│   ├── logger.js
│   ├── response.js
│   ├── validators.js
│   ├── asyncHandler.js
│   └── upload.js
├── logs/                # Application logs
├── server.js            # Entry point
├── package.json
└── .env.example
```

## 🔐 Authentication

All protected routes require a Bearer token in the Authorization header:

```bash
Authorization: Bearer <access_token>
```

### Login Flow
1. User registers with email and password
2. System validates password strength (8+ chars, uppercase, number, special char)
3. User receives both `accessToken` (1h) and `refreshToken` (7d)
4. Use `refreshToken` to get new `accessToken` when expired

## 👥 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full system access, manage all branches, users, and orders |
| **BRANCH_MANAGER** | Manage their branch, users, and orders within their branch |
| **STAFF** | Update order statuses, view orders in their branch |
| **CUSTOMER** | Create orders, view own orders and profile |

## 📚 API Endpoints

### Authentication
- `POST /api/v1/auth/sign-up` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/logout` - Logout (protected)

### Users
- `GET /api/v1/users` - Get all users (SUPER_ADMIN, BRANCH_MANAGER)
- `GET /api/v1/users/:userId` - Get single user (protected)
- `PUT /api/v1/users/:userId` - Update user (SUPER_ADMIN, BRANCH_MANAGER)
- `DELETE /api/v1/users/:userId` - Delete user (SUPER_ADMIN)

### Orders
- `POST /api/v1/orders` - Create order (authenticated)
- `GET /api/v1/orders` - Get orders with filters (authenticated)
- `GET /api/v1/orders/:orderId` - Get single order (authenticated)
- `PUT /api/v1/orders/:orderId` - Update order (SUPER_ADMIN, BRANCH_MANAGER, STAFF)
- `PATCH /api/v1/orders/:orderId/status` - Update order status
- `DELETE /api/v1/orders/:orderId` - Delete order (SUPER_ADMIN)

### Branches
- `POST /api/v1/branch` - Create branch (SUPER_ADMIN)
- `GET /api/v1/branch` - Get all branches (authenticated)
- `GET /api/v1/branch/:branchId` - Get single branch (authenticated)
- `PUT /api/v1/branch/:branchId` - Update branch (SUPER_ADMIN)
- `DELETE /api/v1/branch/:branchId` - Delete branch (SUPER_ADMIN)

### Inventory
- `POST /api/v1/inventory` - Add inventory item (SUPER_ADMIN, BRANCH_MANAGER)
- `GET /api/v1/inventory/branch/:branchId` - Get branch inventory (authenticated)
- `GET /api/v1/inventory/low-stock` - Get low stock items (SUPER_ADMIN, BRANCH_MANAGER)
- `PUT /api/v1/inventory/:itemId` - Update inventory (SUPER_ADMIN, BRANCH_MANAGER)
- `DELETE /api/v1/inventory/:itemId` - Delete inventory (SUPER_ADMIN)

## 🔒 Security Features

- **Helmet.js**: Sets various HTTP headers for protection
- **Rate Limiting**: 100 requests per 15 minutes globally, 5 per 15 minutes for auth
- **JWT Tokens**: Access token (1h) + Refresh token (7d)
- **Password Hashing**: bcryptjs with 10 salt rounds
- **Input Validation**: Comprehensive validation with error responses
- **CORS**: Configurable origin handling
- **Error Handling**: Global error handler preventing information leakage

## 📊 Database Models

### User Schema
```javascript
{
  fullname: String (required),
  email: String (unique, required),
  password: String (hashed, required),
  role: Enum ['SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER'],
  branchId: ObjectId (ref: Branch),
  avatar: String,
  isActive: Boolean,
  lastLogin: Date,
  timestamps: true
}
```

### Order Schema
```javascript
{
  orderNumber: String (unique, auto-generated),
  customerId: ObjectId (ref: User),
  branchId: ObjectId (ref: Branch),
  items: [{
    serviceName: String,
    quantity: Number,
    unitPrice: Number,
    subtotal: Number
  }],
  status: Enum ['RECEIVED', 'WASHING', 'DRYING', 'READY', 'DELIVERED', 'CANCELLED'],
  paymentStatus: Enum ['UNPAID', 'PARTIAL', 'PAID'],
  totalAmount: Number (auto-calculated),
  dueDate: Date,
  assignedStaff: ObjectId,
  timestamps: true
}
```

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["field error 1", "field error 2"]
}
```

## 🛠️ Development

### Available Scripts
```bash
npm start              # Start production server
npm run dev            # Start with hot reload (nodemon)
npm test               # Run tests (coming soon)
npm run lint           # Run ESLint
```

### Logging
Logs are stored in the `logs/` directory with daily rotation:
- `info-YYYY-MM-DD.log`
- `error-YYYY-MM-DD.log`
- `warn-YYYY-MM-DD.log`
- `debug-YYYY-MM-DD.log` (development only)

## 🚨 Error Handling

The API uses standardized HTTP status codes:
- `200` - OK
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid credentials)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate email, etc)
- `500` - Internal Server Error

## 🔄 Future Enhancements

- [ ] Payment integration (Stripe, Paystack)
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Analytics dashboard
- [ ] Automated low-stock alerts
- [ ] Service pricing module
- [ ] Customer reviews & ratings
- [ ] Advanced reporting

## 📞 Support

For issues or questions, please create an issue in the repository.

## 📄 License

ISC
