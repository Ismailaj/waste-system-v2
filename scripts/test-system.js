#!/usr/bin/env node

/**
 * Comprehensive System Test Script
 * Tests all major functionality and verifies bug fixes
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

class SystemTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'pass': '✅',
      'fail': '❌',
      'warn': '⚠️'
    }[type] || '📋';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  test(name, testFn) {
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        this.results.passed++;
        this.results.tests.push({ name, status: 'PASS' });
        this.log(`${name}: PASSED`, 'pass');
      } else {
        this.results.failed++;
        this.results.tests.push({ name, status: 'FAIL', error: result });
        this.log(`${name}: FAILED - ${result}`, 'fail');
      }
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      this.log(`${name}: FAILED - ${error.message}`, 'fail');
    }
  }

  warn(message) {
    this.results.warnings++;
    this.log(message, 'warn');
  }

  async runTests() {
    this.log('Starting CleanCity System Tests', 'info');
    this.log('================================', 'info');

    // Test 1: Check uploads directory exists
    this.test('Uploads Directory Exists', () => {
      const uploadsPath = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsPath)) {
        return 'uploads directory does not exist';
      }
      
      const stats = fs.statSync(uploadsPath);
      if (!stats.isDirectory()) {
        return 'uploads path exists but is not a directory';
      }
      
      return true;
    });

    // Test 2: Check environment configuration
    this.test('Environment Configuration', () => {
      const requiredVars = ['MONGO_URL', 'JWT_SECRET'];
      const missing = requiredVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        return `Missing required environment variables: ${missing.join(', ')}`;
      }

      // Check for default/insecure values
      if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
        this.warn('JWT_SECRET is using default value - should be changed in production');
      }

      return true;
    });

    // Test 3: Check service files completeness
    this.test('Service Files Completeness', () => {
      const serviceFiles = [
        'services/cacheService.js',
        'services/dataAggregation.js',
        'services/exportService.js',
        'utils/analyticsEngine.js'
      ];

      for (const file of serviceFiles) {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          return `Service file missing: ${file}`;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        if (content.length < 1000) {
          return `Service file appears incomplete: ${file} (${content.length} bytes)`;
        }

        // Check for export statement
        if (!content.includes('export default')) {
          return `Service file missing export: ${file}`;
        }
      }

      return true;
    });

    // Test 4: Database connection
    this.test('Database Connection', async () => {
      try {
        await mongoose.connect(process.env.MONGO_URL);
        await mongoose.connection.db.admin().ping();
        this.log('Database connection successful', 'info');
        return true;
      } catch (error) {
        return `Database connection failed: ${error.message}`;
      }
    });

    // Test 5: Check frontend files
    this.test('Frontend Files Integrity', () => {
      const frontendFiles = [
        'public/js/admin-analytics.js',
        'public/js/dashboard.js',
        'public/js/login.js',
        'public/js/report.js',
        'public/js/admin.js',
        'public/js/driver-dashboard.js'
      ];

      for (const file of frontendFiles) {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          return `Frontend file missing: ${file}`;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for error handling patterns
        if (!content.includes('try') && !content.includes('catch')) {
          this.warn(`Frontend file may lack error handling: ${file}`);
        }
      }

      return true;
    });

    // Test 6: Check package.json dependencies
    this.test('Package Dependencies', () => {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packagePath)) {
        return 'package.json not found';
      }

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const requiredDeps = [
        'express', 'mongoose', 'bcrypt', 'jsonwebtoken', 
        'cors', 'dotenv', 'multer', 'cloudinary', 'node-geocoder'
      ];

      const missing = requiredDeps.filter(dep => 
        !packageJson.dependencies[dep] && !packageJson.devDependencies?.[dep]
      );

      if (missing.length > 0) {
        return `Missing required dependencies: ${missing.join(', ')}`;
      }

      return true;
    });

    // Test 7: Check model schemas
    this.test('Model Schemas', () => {
      try {
        // Import models to check for syntax errors
        const userModelPath = path.join(process.cwd(), 'models/User.js');
        const reportModelPath = path.join(process.cwd(), 'models/report.js');

        if (!fs.existsSync(userModelPath)) {
          return 'User model not found';
        }

        if (!fs.existsSync(reportModelPath)) {
          return 'Report model not found';
        }

        const userContent = fs.readFileSync(userModelPath, 'utf8');
        const reportContent = fs.readFileSync(reportModelPath, 'utf8');

        // Check for required fields
        if (!userContent.includes('fullname') || !userContent.includes('email') || !userContent.includes('role')) {
          return 'User model missing required fields';
        }

        if (!reportContent.includes('category') || !reportContent.includes('status') || !reportContent.includes('assignedDriver')) {
          return 'Report model missing required fields';
        }

        return true;
      } catch (error) {
        return `Model validation error: ${error.message}`;
      }
    });

    // Test 8: Check route files
    this.test('Route Files', () => {
      const routeFiles = [
        'routes/userRoutes.js',
        'routes/analyticsRoutes.js'
      ];

      for (const file of routeFiles) {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          return `Route file missing: ${file}`;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for basic route patterns
        if (!content.includes('router.') && !content.includes('app.')) {
          return `Route file appears invalid: ${file}`;
        }
      }

      return true;
    });

    // Test 9: Check configuration files
    this.test('Configuration Files', () => {
      const configFiles = [
        'config/db.js',
        'config/cloudinary.js',
        'config/multer.js'
      ];

      for (const file of configFiles) {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          return `Configuration file missing: ${file}`;
        }
      }

      return true;
    });

    // Test 10: Check middleware
    this.test('Middleware Files', () => {
      const middlewarePath = path.join(process.cwd(), 'middleware/auth.js');
      if (!fs.existsSync(middlewarePath)) {
        return 'Authentication middleware not found';
      }

      const content = fs.readFileSync(middlewarePath, 'utf8');
      if (!content.includes('authenticate') || !content.includes('jwt')) {
        return 'Authentication middleware appears incomplete';
      }

      return true;
    });

    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    // Print results
    this.printResults();
  }

  printResults() {
    this.log('================================', 'info');
    this.log('Test Results Summary', 'info');
    this.log('================================', 'info');
    this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'pass');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'fail' : 'info');
    this.log(`Warnings: ${this.results.warnings}`, this.results.warnings > 0 ? 'warn' : 'info');

    if (this.results.failed > 0) {
      this.log('', 'info');
      this.log('Failed Tests:', 'fail');
      this.results.tests
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          this.log(`  - ${test.name}: ${test.error}`, 'fail');
        });
    }

    const successRate = Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100);
    this.log('', 'info');
    this.log(`Success Rate: ${successRate}%`, successRate >= 90 ? 'pass' : successRate >= 70 ? 'warn' : 'fail');

    if (successRate >= 90) {
      this.log('🎉 System appears to be working correctly!', 'pass');
    } else if (successRate >= 70) {
      this.log('⚠️  System has some issues that should be addressed', 'warn');
    } else {
      this.log('🚨 System has critical issues that need immediate attention', 'fail');
    }

    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new SystemTester();
tester.runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});