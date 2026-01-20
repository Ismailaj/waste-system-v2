# CleanCity - Waste Reporting System

A comprehensive waste reporting system that enables citizens to report waste issues, illegal dumping, and hazardous materials in their city. The platform connects citizens, waste collectors, and city administrators to improve urban cleanliness and environmental management.

##  Features

### Core Functionality
- **Citizen Reporting**: Submit waste reports with photos, location, and descriptions
- **Interactive Maps**: View report locations with Leaflet.js integration
- **Geocoding**: Automatic address-to-coordinate conversion using OpenStreetMap
- **Photo Upload**: Cloudinary integration for secure image storage
- **Real-time Status Tracking**: Monitor report progress from submission to resolution

### User Roles & Dashboards
- **Citizens**: Create reports, view personal dashboard with interactive maps
- **Drivers**: Dedicated dashboard for assigned reports, status updates, rejection handling
- **Admins**: Comprehensive management interface, user oversight, driver assignment

### Advanced Features
- **Driver Assignment System**: Admins can assign reports to specific drivers
- **Rejection Messaging**: Clear feedback system with audit trails
- **Admin Direct Reporting**: Streamlined incident recording with automatic assignment
- **Location History**: Visual map showing user's last 3 report locations
- **Role-based Access Control**: JWT authentication with proper permissions

##  Quick Start

### Prerequisites
- Node.js (v18.0.0 or higher)
- MongoDB database
- Cloudinary account (for image uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cleancity/waste-reporting-system.git
   cd waste-reporting-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGO_URL=mongodb://localhost:27017/cleancity
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key
   
   # Server
   PORT=5050
   
   # Cloudinary (for image uploads)
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   
   # Analytics Caching (Optional - Redis)
   ENABLE_ANALYTICS_CACHE=false
   CACHE_SILENT_MODE=true
   REDIS_URL=redis://localhost:6379
   ```

4. **Optional: Redis Setup for Analytics Caching**
   
   Redis provides performance improvements for analytics queries but is not required.
   
   **Option 1: Skip Redis (Recommended for development)**
   ```env
   ENABLE_ANALYTICS_CACHE=false
   CACHE_SILENT_MODE=true
   ```
   
   **Option 2: Install Redis locally**
   ```bash
   # Windows (using Chocolatey)
   choco install redis-64
   
   # macOS (using Homebrew)
   brew install redis
   
   # Ubuntu/Debian
   sudo apt install redis-server
   
   # Start Redis
   redis-server
   ```
   
   Then update your `.env`:
   ```env
   ENABLE_ANALYTICS_CACHE=true
   CACHE_SILENT_MODE=false
   ```

5. **Test Database Connection**
   ```bash
   npm run db:test
   ```

6. **Create Admin User**
   ```bash
   npm run admin:create
   ```

7. **Start the Server**
   ```bash
   npm start
   # or for development with auto-restart
   npm run dev
   ```

7. **Seed Database (Optional)**
   ```bash
   # Populate with sample data for testing
   npm run db:seed
   
   # Or run complete setup with seeding
   npm run setup:full
   ```

8. **Access the Application**
   Open your browser and navigate to `http://localhost:5050`

##  Sample Data & Testing

### Quick Setup with Sample Data
```bash
npm run setup:full  # Install + DB test + seed data
```

### Seeding Commands
```bash
npm run db:seed     # Add sample users and reports
npm run db:clear    # Clear all data
npm run setup:full  # Complete setup with sample data
```

### Test Accounts (After Seeding)
```bash
# Admin Access
Email: admin@cleancity.com
Password: admin123

# Driver Access  
Email: mike.johnson@example.com
Password: password123

# Citizen Access
Email: john.doe@example.com
Password: password123
```

The seed script creates:
- **7 Users** (4 citizens, 2 drivers, 1 admin)
- **10 Reports** with various statuses and real geocoded addresses
- **Realistic Scenarios** including assignments, rejections, and admin reports

##  Project Structure

```
cleancity-waste-reporting/
├── config/                 # Configuration files
│   ├── db.js              # MongoDB connection
│   ├── cloudinary.js      # Cloudinary setup
│   └── multer.js          # File upload middleware
├── middleware/            # Express middleware
│   └── auth.js           # Authentication & authorization
├── models/               # Database models
│   ├── User.js          # User schema with roles
│   └── report.js        # Report schema with geocoding
├── routes/              # API routes
│   └── userRoutes.js    # All API endpoints
├── utils/               # Utility functions
│   └── geocoding.js     # Address geocoding service
├── public/              # Frontend files
│   ├── index.html       # Landing page
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│   │   ├── dashboard.js
│   │   ├── admin.js
│   │   ├── driver-dashboard.js
│   │   └── ...
│   └── pages/          # HTML pages
│       ├── login.html
│       ├── dashboard.html
│       ├── admin.html
│       └── ...
├── scripts/            # Utility scripts
│   ├── createAdmin.js  # Create admin users
│   ├── test-connection.js
│   └── ...
├── assets/             # Static assets
└── server.js           # Main application entry point
```

##  Available Scripts

```bash
# Development
npm start              # Start production server
npm run dev           # Start development server with auto-restart
npm run serve         # Alternative start command

# Testing & Utilities
npm test              # Test database connection
npm run test:geocoder # Test geocoding functionality
npm run db:test       # Test database connection

# Admin Management
npm run admin:create  # Create new admin user
npm run admin:verify  # Verify admin access

# Maintenance
npm run setup         # Install dependencies and test DB
npm run clean         # Clean install (remove node_modules)
```

##  Database Schema

### User Model
```javascript
{
  fullname: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: ["citizen", "admin", "driver"], default: "citizen"),
  createdAt: Date,
  updatedAt: Date
}
```

### Report Model
```javascript
{
  category: String (required) // "recyclable", "illegal_dumping", "hazardous_waste"
  address: String (required),
  description: String,
  photos: [String], // Cloudinary URLs
  status: String (default: "Pending"),
  user: ObjectId (ref: "User"),
  // Enhanced fields
  latitude: Number,
  longitude: Number,
  assignedDriver: ObjectId (ref: "User"),
  rejectionMessage: String,
  rejectedAt: Date,
  rejectedBy: ObjectId (ref: "User"),
  isAdminReport: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

##  API Endpoints

### Authentication
- `POST /api/users/signup` - User registration
- `POST /api/users/login` - User login

### Citizen Endpoints
- `POST /api/users/report` - Create new report (with geocoding)
- `GET /api/users/dashboard` - Get user dashboard data with map locations

### Driver Endpoints
- `GET /api/users/driver/reports` - Get assigned reports
- `PATCH /api/users/driver/reports/:id/status` - Update report status

### Admin Endpoints
- `GET /api/users/reports` - Get all reports
- `GET /api/users/all` - Get all users
- `GET /api/users/drivers` - Get available drivers
- `POST /api/users/reports/:id/assign` - Assign driver to report
- `POST /api/users/admin/report` - Create admin report with auto-assignment
- `PATCH /api/users/reports/:id/status` - Update report status

##  Technology Stack

### Backend
- **Node.js** with **Express.js** - RESTful API server
- **MongoDB** with **Mongoose** - Database and ODM
- **JWT** - Authentication and authorization
- **bcrypt** - Password hashing
- **Multer** + **Cloudinary** - File upload and storage
- **node-geocoder** - Address geocoding with OpenStreetMap

### Frontend
- **Vanilla HTML/CSS/JavaScript** - No framework dependencies
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet.js** - Interactive maps
- **Material Symbols** - Icon font

##  Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URL` | MongoDB connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `PORT` | Server port (default: 5050) | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |

### Default User Roles
- **citizen**: Default role for new users
- **admin**: Full system access, user management, report assignment
- **driver**: Access to assigned reports, status updates

##  User Workflows

### Citizen Workflow
1. Register/Login to the system
2. Submit waste reports with photos and location
3. View personal dashboard with interactive map
4. Track report status and view rejection feedback

### Driver Workflow
1. Login with driver credentials
2. View assigned reports in driver dashboard
3. Update report status (In Progress, Completed, Rejected)
4. Provide rejection messages when necessary

### Admin Workflow
1. Login with admin credentials
2. View all reports and users in admin dashboard
3. Assign reports to available drivers
4. Create direct incident reports with automatic assignment
5. Monitor system-wide statistics and activity


### Docker Deployment (Optional)
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5050
CMD ["npm", "start"]
```


**CleanCity** - Making cities cleaner, one report at a time. 