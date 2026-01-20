import express from "express"; //the backend framework
import cors from "cors"; //allows html to communicate with backend
import dotenv from "dotenv"; //imports my .env file
import connectDB from "./config/db.js"; //my connectDB function
import router from "./routes/userRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

import driverRoutes from "./routes/driverRoutes.js";

dotenv.config(); //load/process credentials from my .env file
const app = express(); //initialize express

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

//middleware
app.use(cors()); //allows frontend requests

// Enhanced JSON parsing with error handling
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      // Don't send response here, let the error handler deal with it
      throw new Error('Invalid JSON format');
    }
  }
}));

// URL encoded data parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// serve static frontend files
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// connect to Mongo (fail fast on DB errors)
try {
  await connectDB();
  console.log('Database connection established successfully');
} catch (err) {
  console.error("Database connection failed:", err);
  process.exit(1);
}

//activate Routes
app.use("/api/users", router);
<<<<<<< HEAD
app.use("/api/driver", driverRoutes);
=======
app.use("/api/analytics", analyticsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "System running successfully",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
>>>>>>> pr-2

app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "CleanCity API - System running successfully",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Check if response has already been sent
  if (res.headersSent) {
    return next(error);
  }
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5050;

const server = app.listen(PORT, () => {
  console.log(`✅ CleanCity Server running successfully on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}`);
  console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics/health`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
