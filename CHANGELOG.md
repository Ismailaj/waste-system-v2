# Changelog

All notable changes to the CleanCity Waste Reporting System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-11

###  Major Release - Enhanced Reporting Workflow

This major release introduces comprehensive enhancements to the waste reporting system, including geocoding, driver assignment, interactive maps, and role-based workflows.

###  Added

#### Core Features
- **Geocoding Integration**: Automatic address-to-coordinate conversion using OpenStreetMap
- **Interactive Maps**: Leaflet.js integration showing user's recent report locations
- **Driver Role**: New user role with dedicated dashboard and workflow
- **Driver Assignment**: Admin capability to assign reports to specific drivers
- **Admin Direct Reporting**: Streamlined incident recording with automatic assignment
- **Rejection Messaging**: Comprehensive feedback system with audit trails

#### User Interfaces
- **Enhanced User Dashboard**: Interactive maps showing last 3 report locations with clickable markers
- **Driver Dashboard**: Dedicated interface for managing assigned reports and status updates
- **Admin Report Creation**: Specialized form for admin direct incident recording
- **Enhanced Admin Dashboard**: Driver assignment controls and system oversight

#### Technical Enhancements
- **Organized File Structure**: Separated frontend files into logical directories (`/pages`, `/js`, `/css`)
- **Comprehensive Package.json**: Enhanced with proper metadata, scripts, and dependencies
- **Environment Configuration**: Template file (`.env.example`) with detailed documentation
- **Enhanced Documentation**: Comprehensive README.md with setup and usage instructions

#### API Endpoints
- `POST /api/users/admin/report` - Admin direct reporting with automatic assignment
- `POST /api/users/reports/:id/assign` - Assign driver to report
- `GET /api/users/drivers` - Get available drivers list
- `GET /api/users/driver/reports` - Driver dashboard data
- `PATCH /api/users/driver/reports/:id/status` - Driver status updates

#### Database Enhancements
- **Extended User Model**: Added "driver" role support with proper validation
- **Enhanced Report Model**: Added geocoding fields, assignment tracking, and rejection metadata
- **Performance Indexes**: Optimized queries for geospatial data and assignments
- **Audit Trails**: Complete tracking of report lifecycle and user actions

###  Changed

#### Data Models
- **User Schema**: Enhanced role field with enum validation for citizen/admin/driver
- **Report Schema**: Added latitude, longitude, assignedDriver, rejectionMessage, rejectedAt, rejectedBy, isAdminReport fields
- **Database Indexes**: Added indexes for assignedDriver, coordinates, and status filtering

#### API Enhancements
- **Report Creation**: Enhanced with automatic geocoding integration
- **Dashboard Endpoint**: Extended with map data and location history
- **Status Updates**: Enhanced with rejection message validation and audit trails
- **Authentication**: Extended to support driver role permissions

#### Frontend Organization
- **File Structure**: Reorganized HTML files into `/public/pages/` directory
- **JavaScript Files**: Moved to `/public/js/` directory with logical naming
- **Navigation**: Updated all internal links to reflect new structure
- **Responsive Design**: Enhanced mobile compatibility and user experience

#### Package Management
- **Dependencies**: Updated to stable versions with security patches
- **Scripts**: Comprehensive npm scripts for development, testing, and maintenance
- **Metadata**: Enhanced package.json with proper project information

### Technical Improvements

#### Code Organization
- **Modular Structure**: Separated concerns with logical file organization
- **Error Handling**: Comprehensive error handling throughout the application
- **Validation**: Enhanced input validation and sanitization
- **Security**: Improved authentication and authorization mechanisms

#### Development Experience
- **Environment Setup**: Streamlined with template files and clear documentation
- **Scripts**: Comprehensive npm scripts for all development tasks
- **Documentation**: Detailed README with setup instructions and API documentation
- **Maintenance**: Utility scripts for admin management and system testing

#### Performance Optimizations
- **Database Queries**: Optimized with proper indexing and population
- **Geocoding**: Efficient caching and error handling
- **Frontend**: Optimized asset loading and responsive design
- **API Responses**: Structured responses with consistent error handling

### Migration Notes

#### For Existing Installations
1. **Database Migration**: Existing reports will work without modification
2. **User Roles**: Existing users retain their current roles
3. **Environment Variables**: Update `.env` file using the new template
4. **File Paths**: Frontend file paths have changed - clear browser cache

#### New Environment Variables
- `CLOUDINARY_CLOUD_NAME` - Required for image uploads
- `CLOUDINARY_API_KEY` - Required for image uploads  
- `CLOUDINARY_API_SECRET` - Required for image uploads

#### Breaking Changes
- **Frontend File Paths**: HTML files moved to `/public/pages/`
- **JavaScript Paths**: JS files moved to `/public/js/`
- **API Responses**: Enhanced with additional metadata fields

###  Security Enhancements
- **Role-based Access Control**: Enhanced permissions for driver role
- **Input Validation**: Comprehensive validation for all user inputs
- **Error Handling**: Secure error messages without sensitive information exposure
- **Environment Protection**: Enhanced .gitignore and environment templates

###  Documentation
- **README.md**: Comprehensive project documentation with setup instructions
- **CHANGELOG.md**: Detailed change tracking and migration notes
- **Environment Template**: Complete `.env.example` with all configuration options
- **API Documentation**: Detailed endpoint documentation in README

### Testing
- **Database Testing**: Enhanced connection testing scripts
- **Geocoding Testing**: Dedicated geocoding functionality tests
- **Admin Utilities**: Scripts for admin user creation and verification
- **Status Testing**: Report status update validation scripts

---

## [1.0.0] - 2025-12-01

### Initial Release

#### Features
- Basic waste reporting system
- User authentication (citizen/admin roles)
- Photo upload with Cloudinary
- Admin dashboard for report management
- Basic user dashboard
- MongoDB integration
- Express.js API server

#### Core Functionality
- User registration and login
- Report submission with photos
- Admin report management
- Basic status tracking
- File upload handling

---

**Note**: This changelog follows [Keep a Changelog](https://keepachangelog.com/) format. For migration assistance or questions about changes, please refer to the README.md or create an issue on GitHub.