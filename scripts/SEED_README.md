# Database Seeding Guide

This guide explains how to use the database seeding functionality to populate your CleanCity database with sample data for development and testing.

## Quick Start

```bash
# Seed the database with sample data
npm run db:seed

# Or run full setup (install + test + seed)
npm run setup:full
```

## Available Commands

### `npm run db:seed`
Populates the database with comprehensive sample data including:
- **7 Users** across all roles (citizens, drivers, admin)
- **10 Reports** with various statuses and categories
- **Geocoded Addresses** from major US cities
- **Realistic Relationships** (assignments, rejections, etc.)

### `npm run db:clear`
Clears all existing data from the database without adding new data.

### `npm run setup:full`
Complete setup process:
1. Install dependencies
2. Test database connection
3. Seed database with sample data

## Sample Data Overview

### Users Created
- **4 Citizens**: Regular users who can create reports
- **2 Drivers**: Can manage assigned reports and update statuses
- **1 Admin**: Full system access and management capabilities

### Reports Created
- **Various Categories**: Recyclable, illegal dumping, hazardous waste
- **Different Statuses**: Pending, Assigned, In Progress, Completed, Rejected
- **Geocoded Locations**: Real addresses from major US cities
- **Realistic Scenarios**: Detailed descriptions and appropriate assignments

### Key Features Demonstrated
- **Geocoding Integration**: Addresses automatically converted to coordinates
- **Driver Assignments**: Reports properly assigned to drivers
- **Rejection Handling**: Sample rejection with detailed messages
- **Admin Reports**: Examples of admin-created reports with auto-assignment
- **Status Workflows**: Complete lifecycle from creation to resolution

## Login Credentials

After seeding, you can log in with these accounts:

### Admin Access
- **Email**: `admin@cleancity.com`
- **Password**: `admin123`
- **Capabilities**: Full system management, user oversight, driver assignment

### Driver Access
- **Email**: `mike.johnson@example.com`
- **Password**: `password123`
- **Capabilities**: View assigned reports, update statuses, provide feedback

### Citizen Access
- **Email**: `john.doe@example.com`
- **Password**: `password123`
- **Capabilities**: Create reports, view personal dashboard with maps

## Sample Addresses

The seed script uses real addresses from major US cities:
- New York, NY
- Los Angeles, CA
- Chicago, IL
- Houston, TX
- Phoenix, AZ
- Philadelphia, PA
- San Antonio, TX
- San Diego, CA
- Dallas, TX
- San Jose, CA
- Austin, TX
- Jacksonville, FL

## Geocoding Behavior

The seed script attempts to geocode all addresses using the OpenStreetMap service:
- **Success**: Coordinates are stored with the report for map display
- **Failure**: Report is created without coordinates (graceful fallback)
- **Rate Limiting**: Small delays between requests to respect service limits

## Database Structure After Seeding

### Users Collection
```javascript
{
  fullname: "John Doe",
  email: "john.doe@example.com",
  role: "citizen", // citizen, driver, or admin
  password: "hashed_password",
  createdAt: "2026-01-11T...",
  updatedAt: "2026-01-11T..."
}
```

### Reports Collection
```javascript
{
  category: "illegal_dumping", // recyclable, illegal_dumping, hazardous_waste
  address: "123 Main Street, New York, NY 10001",
  description: "Detailed description of the waste issue",
  status: "Assigned", // Pending, Assigned, In Progress, Completed, Rejected
  user: ObjectId("..."), // Reference to reporting user
  assignedDriver: ObjectId("..."), // Reference to assigned driver (if any)
  latitude: 40.7128,
  longitude: -74.0060,
  rejectionMessage: "Reason for rejection (if rejected)",
  rejectedBy: ObjectId("..."), // Reference to user who rejected
  rejectedAt: "2026-01-11T...",
  isAdminReport: false,
  photos: [], // Empty in seed data
  createdAt: "2026-01-11T...",
  updatedAt: "2026-01-11T..."
}
```

## Testing Scenarios

After seeding, you can test these scenarios:

### Citizen Workflow
1. Log in as John Doe
2. View dashboard with interactive map showing report locations
3. Create new reports and see automatic geocoding
4. Track report status changes

### Driver Workflow
1. Log in as Mike Johnson
2. View assigned reports in driver dashboard
3. Update report statuses (In Progress, Completed, Rejected)
4. Provide rejection messages with validation

### Admin Workflow
1. Log in as admin
2. View all reports and users in admin dashboard
3. Assign reports to available drivers
4. Create direct incident reports with automatic assignment
5. Monitor system statistics and activity

## Troubleshooting

### Geocoding Issues
- **Rate Limiting**: If many addresses fail, wait a few minutes and try again
- **Network Issues**: Ensure internet connection for OpenStreetMap API
- **Service Unavailable**: Reports will still be created without coordinates

### Database Connection
- **Connection Failed**: Verify MongoDB is running and MONGO_URL is correct
- **Authentication Error**: Check database credentials in .env file
- **Permission Issues**: Ensure database user has read/write permissions

### Seed Script Errors
- **Duplicate Key Error**: Run `npm run db:clear` first to remove existing data
- **Validation Error**: Check that all required environment variables are set
- **Memory Issues**: Reduce batch size or add more delays between operations

## Customization

To customize the seed data:

1. **Edit User Data**: Modify `sampleUsers` array in `scripts/seed.js`
2. **Add Addresses**: Extend `sampleAddresses` array with your preferred locations
3. **Modify Reports**: Update `sampleReports` array with different scenarios
4. **Adjust Timing**: Change delays between geocoding requests if needed

## Production Considerations

**WARNING**: Never run seeding scripts in production environments!

- Seeding scripts clear existing data
- Use only for development and testing
- Consider creating separate staging environments
- Always backup production data before any database operations

## Support

If you encounter issues with seeding:
1. Check the console output for specific error messages
2. Verify your .env configuration
3. Ensure MongoDB is running and accessible
4. Test database connection with `npm run db:test`
5. Check network connectivity for geocoding services