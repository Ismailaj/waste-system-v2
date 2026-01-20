import express from 'express';
import AnalyticsEngine from '../utils/analyticsEngine.js';
import DataAggregationService from '../services/dataAggregation.js';
import CacheService from '../services/cacheService.js';
import ExportService from '../services/exportService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Report from '../models/report.js';

/**
 * Enhanced error handler middleware for analytics routes
 * @param {Error} error - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const handleAnalyticsError = (error, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  console.error(`[ERROR] Analytics API [${requestId}] ${req.method} ${req.path}:`, {
    message: error.message,
    stack: error.stack,
    query: req.query,
    body: req.body,
    timestamp
  });

  // Determine error type and appropriate response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let userMessage = 'An internal server error occurred';

  if (error.message.includes('timeout')) {
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
    userMessage = 'Request timed out. Please try with smaller date range or additional filters.';
  } else if (error.message.includes('validation')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    userMessage = 'Invalid request parameters. Please check your input.';
  } else if (error.message.includes('not found')) {
    statusCode = 404;
    errorCode = 'RESOURCE_NOT_FOUND';
    userMessage = 'Requested resource not found.';
  } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
    statusCode = 403;
    errorCode = 'ACCESS_DENIED';
    userMessage = 'Access denied. Admin privileges required.';
  } else if (error.message.includes('too large') || error.message.includes('BSONObj size')) {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    userMessage = 'Result set too large. Please add filters or use pagination.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: userMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId,
      timestamp
    }
  });
};

/**
 * Validate request parameters for analytics endpoints
 * @param {Object} params - Parameters to validate
 * @param {Array} required - Required parameter names
 * @returns {Object} Validation result
 */
const validateRequestParams = (params, required = []) => {
  const errors = [];
  const warnings = [];

  // Check required parameters
  required.forEach(param => {
    if (!params[param]) {
      errors.push(`Missing required parameter: ${param}`);
    }
  });

  // Validate date parameters
  ['startDate', 'endDate', 'period1Start', 'period1End', 'period2Start', 'period2End'].forEach(dateParam => {
    if (params[dateParam]) {
      const date = new Date(params[dateParam]);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid date format for ${dateParam}: ${params[dateParam]}`);
      }
    }
  });

  // Validate numeric parameters
  ['page', 'limit', 'gridSize', 'maxReports'].forEach(numParam => {
    if (params[numParam] !== undefined) {
      const num = parseFloat(params[numParam]);
      if (isNaN(num) || num < 0) {
        errors.push(`Invalid numeric value for ${numParam}: ${params[numParam]}`);
      }
    }
  });

  // Validate enum parameters
  const validCategories = ['all', 'recyclable', 'illegal_dumping', 'hazardous_waste'];
  if (params.category && !validCategories.includes(params.category)) {
    errors.push(`Invalid category: ${params.category}. Valid values: ${validCategories.join(', ')}`);
  }

  const validStatuses = ['all', 'Pending', 'Assigned', 'In Progress', 'Completed', 'Rejected'];
  if (params.status && !validStatuses.includes(params.status)) {
    errors.push(`Invalid status: ${params.status}. Valid values: ${validStatuses.join(', ')}`);
  }

  // Validate pagination limits
  if (params.limit) {
    const limit = parseInt(params.limit);
    if (limit > 10000) {
      warnings.push('Large limit value may impact performance. Consider using pagination.');
    }
  }

  // Validate date ranges
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (start > end) {
        errors.push('startDate cannot be after endDate');
      }
      
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        warnings.push('Large date range may impact performance. Consider smaller ranges or pagination.');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

const router = express.Router();

// Initialize services
const analyticsEngine = new AnalyticsEngine();
const dataAggregation = new DataAggregationService();
const cacheService = new CacheService();
const exportService = new ExportService();

// Middleware to ensure admin access for all analytics routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/analytics/trends
 * Get trend analysis data for specified date range and filters
 */
router.get('/trends', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      category = 'all', 
      status = 'all',
      page = 1,
      limit = 100,
      optimize = 'true'
    } = req.query;

    // Enhanced parameter validation
    const validation = validateRequestParams(req.query, ['startDate', 'endDate']);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: validation.errors,
          warnings: validation.warnings,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('[WARN] Analytics API - /trends:', validation.warnings);
    }

    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    const filters = { category, status };
    const pagination = { 
      page: Math.max(1, parseInt(page)), 
      limit: Math.min(10000, Math.max(1, parseInt(limit))) // Enforce reasonable limits
    };

    // Check cache first
    const cacheKey = cacheService.generateCacheKey('trends', { ...filters, ...pagination }, dateRange);
    let result = await cacheService.getCachedData(cacheKey);

    if (!result) {
      // Estimate dataset size for performance optimization
      const sizeEstimate = await dataAggregation.estimateDatasetSize({
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        ...(category !== 'all' && { category }),
        ...(status !== 'all' && { status })
      });

      // Show progress indicator for large datasets
      let progressTracker = null;
      if (sizeEstimate.totalDocuments > 10000) {
        progressTracker = dataAggregation.createProgressTracker('trends-analysis', 3);
        progressTracker.updateProgress(1, 'Analyzing dataset size');
      }

      // Generate fresh data with quality metrics
      const trendData = await dataAggregation.aggregateTrendsByCategory(dateRange, filters);
      
      if (progressTracker) {
        progressTracker.updateProgress(2, 'Processing trend data');
      }

      // Calculate data quality metrics
      const dataQuality = await analyticsEngine.calculateDataQuality(trendData.rawRecords || []);

      // Apply pagination if requested
      let paginatedData = trendData;
      if (pagination.limit < 1000) { // Only paginate if reasonable limit
        // For trends, pagination applies to daily data points
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        
        if (trendData.dailyTrends) {
          const totalItems = trendData.dailyTrends.length;
          paginatedData = {
            ...trendData,
            dailyTrends: trendData.dailyTrends.slice(startIndex, endIndex),
            pagination: {
              page: pagination.page,
              limit: pagination.limit,
              total: totalItems,
              totalPages: Math.ceil(totalItems / pagination.limit),
              hasNext: endIndex < totalItems,
              hasPrev: pagination.page > 1
            }
          };
        }
      }

      // Add performance metrics
      result = {
        success: true,
        data: paginatedData,
        dataQuality,
        performance: {
          datasetSize: sizeEstimate,
          processingTime: Date.now(),
          optimizationApplied: optimize === 'true'
        }
      };

      if (progressTracker) {
        progressTracker.complete('Trend analysis completed');
      }

      // Cache the result
      await cacheService.cacheAnalyticsData(cacheKey, result);
    }

    res.json({
      success: true,
      data: result.data,
      dataQuality: result.dataQuality || {
        totalRecords: 0,
        validRecords: 0,
        excludedRecords: 0,
        qualityScore: 100,
        exclusionReasons: {},
        recommendations: []
      },
      filters: { dateRange, category, status },
      cached: !!result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /trends:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'TREND_ANALYSIS_ERROR',
        message: 'Failed to generate trend analysis',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/trends/comparison
 * Compare trends between two time periods
 */
router.get('/trends/comparison', async (req, res) => {
  try {
    const { 
      period1Start, period1End, 
      period2Start, period2End, 
      category = 'all' 
    } = req.query;

    if (!period1Start || !period1End || !period2Start || !period2End) {
      return res.status(400).json({
        error: {
          code: 'INVALID_COMPARISON_PERIODS',
          message: 'All period dates are required for comparison',
          timestamp: new Date().toISOString()
        }
      });
    }

    const period1 = { startDate: new Date(period1Start), endDate: new Date(period1End) };
    const period2 = { startDate: new Date(period2Start), endDate: new Date(period2End) };
    const filters = { category };

    // Get data for both periods
    const [period1Data, period2Data] = await Promise.all([
      dataAggregation.aggregateTrendsByCategory(period1, filters),
      dataAggregation.aggregateTrendsByCategory(period2, filters)
    ]);

    // Calculate percentage changes
    const comparison = await analyticsEngine.calculatePercentageChanges(
      period1Data.dailyTrends || [],
      period2Data.dailyTrends || []
    );

    res.json({
      success: true,
      data: {
        period1: { ...period1Data, dateRange: period1 },
        period2: { ...period2Data, dateRange: period2 },
        comparison
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /trends/comparison:', error.message);
    res.status(500).json({
      error: {
        code: 'COMPARISON_ERROR',
        message: 'Failed to generate trend comparison',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/geographic
 * Get geographic distribution of incidents
 */
router.get('/geographic', async (req, res) => {
  try {
    const { 
      north, south, east, west, 
      category = 'all', 
      startDate, endDate 
    } = req.query;

    const filters = { category };
    
    if (startDate && endDate) {
      filters.dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    }

    const bounds = (north && south && east && west) ? 
      { north: parseFloat(north), south: parseFloat(south), east: parseFloat(east), west: parseFloat(west) } : 
      null;

    // Check cache
    const cacheKey = cacheService.generateCacheKey('geographic', { ...filters, bounds: bounds ? 'bounded' : 'all' });
    let result = await cacheService.getCachedData(cacheKey);

    if (!result) {
      const geographicData = await dataAggregation.aggregateByLocation(bounds, filters);
      const dataQuality = await analyticsEngine.calculateDataQuality(geographicData.rawRecords || []);
      
      result = {
        ...geographicData,
        dataQuality
      };
      
      await cacheService.cacheAnalyticsData(cacheKey, result);
    }

    res.json({
      success: true,
      data: result,
      dataQuality: result.dataQuality || {
        totalRecords: 0,
        validRecords: 0,
        excludedRecords: 0,
        qualityScore: 100,
        exclusionReasons: {}
      },
      filters: { bounds, category, dateRange: filters.dateRange },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /geographic:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'GEOGRAPHIC_ANALYSIS_ERROR',
        message: 'Failed to generate geographic analysis',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/heatmap
 * Get heat map data for incident density visualization
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { 
      gridSize = 0.01, 
      category = 'all', 
      startDate, endDate 
    } = req.query;

    const filters = { category };
    
    if (startDate && endDate) {
      filters.dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    }

    const cacheKey = cacheService.generateCacheKey('heatmap', { ...filters, gridSize });
    let heatmapData = await cacheService.getCachedData(cacheKey);

    if (!heatmapData) {
      heatmapData = await dataAggregation.calculateDensityGrid(parseFloat(gridSize), filters);
      await cacheService.cacheAnalyticsData(cacheKey, heatmapData);
    }

    res.json({
      success: true,
      data: heatmapData,
      filters: { gridSize: parseFloat(gridSize), category, dateRange: filters.dateRange },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /heatmap:', error.message);
    res.status(500).json({
      error: {
        code: 'HEATMAP_ERROR',
        message: 'Failed to generate heatmap data',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/drivers
 * Get driver performance metrics with enhanced calculations
 */
router.get('/drivers', async (req, res) => {
  try {
    const { 
      metric = 'completion_rate', 
      period = '30d',
      driverId = null,
      startDate,
      endDate 
    } = req.query;

    // Determine date range
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    } else {
      // Parse period (e.g., '30d', '7d', '90d')
      const days = parseInt(period.replace('d', '')) || 30;
      const endDateCalc = new Date();
      const startDateCalc = new Date();
      startDateCalc.setDate(startDateCalc.getDate() - days);
      dateRange = { startDate: startDateCalc, endDate: endDateCalc };
    }

    const cacheKey = cacheService.generateCacheKey('drivers_enhanced', { metric, period, driverId }, dateRange);
    let driverData = await cacheService.getCachedData(cacheKey);

    if (!driverData) {
      // Use enhanced driver metrics calculation
      driverData = await analyticsEngine.calculateDriverMetrics(driverId, dateRange);
      await cacheService.cacheAnalyticsData(cacheKey, driverData);
    }

    res.json({
      success: true,
      data: driverData,
      filters: { metric, period, driverId, dateRange },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /drivers:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'DRIVER_METRICS_ERROR',
        message: 'Failed to generate driver performance metrics',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/drivers/:driverId/ranking
 * Get driver performance ranking and peer comparison
 */
router.get('/drivers/:driverId/ranking', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate, period = '30d' } = req.query;

    // Determine date range
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    } else {
      const days = parseInt(period.replace('d', '')) || 30;
      const endDateCalc = new Date();
      const startDateCalc = new Date();
      startDateCalc.setDate(startDateCalc.getDate() - days);
      dateRange = { startDate: startDateCalc, endDate: endDateCalc };
    }

    const cacheKey = cacheService.generateCacheKey('driver_ranking', { driverId }, dateRange);
    let rankingData = await cacheService.getCachedData(cacheKey);

    if (!rankingData) {
      rankingData = await analyticsEngine.getDriverPerformanceRanking(driverId, dateRange);
      await cacheService.cacheAnalyticsData(cacheKey, rankingData, 300); // Cache for 5 minutes
    }

    res.json({
      success: true,
      data: rankingData,
      filters: { driverId, dateRange },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /drivers/:driverId/ranking:', error.message);
    
    if (error.message.includes('Driver not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DRIVER_NOT_FOUND',
          message: 'Driver not found in performance data for the specified period',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'DRIVER_RANKING_ERROR',
        message: 'Failed to generate driver ranking',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/drivers/assignment-tracking
 * Get driver assignment tracking and accuracy metrics
 */
router.get('/drivers/assignment-tracking', async (req, res) => {
  try {
    const { 
      driverId = null,
      startDate,
      endDate,
      period = '30d' 
    } = req.query;

    // Determine date range
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    } else {
      const days = parseInt(period.replace('d', '')) || 30;
      const endDateCalc = new Date();
      const startDateCalc = new Date();
      startDateCalc.setDate(startDateCalc.getDate() - days);
      dateRange = { startDate: startDateCalc, endDate: endDateCalc };
    }

    const cacheKey = cacheService.generateCacheKey('assignment_tracking', { driverId }, dateRange);
    let trackingData = await cacheService.getCachedData(cacheKey);

    if (!trackingData) {
      trackingData = await analyticsEngine.getDriverAssignmentTracking(driverId, dateRange);
      await cacheService.cacheAnalyticsData(cacheKey, trackingData);
    }

    res.json({
      success: true,
      data: trackingData,
      filters: { driverId, dateRange },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /drivers/assignment-tracking:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGNMENT_TRACKING_ERROR',
        message: 'Failed to generate assignment tracking metrics',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/status-distribution
 * Get status distribution and workflow analytics
 */
router.get('/status-distribution', async (req, res) => {
  try {
    const { startDate, endDate, category = 'all' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'startDate and endDate are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    const filters = { category };

    const cacheKey = cacheService.generateCacheKey('status', filters, dateRange);
    let statusData = await cacheService.getCachedData(cacheKey);

    if (!statusData) {
      statusData = await dataAggregation.aggregateStatusTransitions(dateRange, filters);
      await cacheService.cacheAnalyticsData(cacheKey, statusData);
    }

    res.json({
      success: true,
      data: statusData,
      filters: { dateRange, category },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /status-distribution:', error.message);
    res.status(500).json({
      error: {
        code: 'STATUS_ANALYSIS_ERROR',
        message: 'Failed to generate status distribution analysis',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/resolution-times
 * Get resolution time analytics by category
 */
router.get('/resolution-times', async (req, res) => {
  try {
    const { startDate, endDate, category = 'all' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'startDate and endDate are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    const filters = { category };

    const cacheKey = cacheService.generateCacheKey('resolution', filters, dateRange);
    let resolutionData = await cacheService.getCachedData(cacheKey);

    if (!resolutionData) {
      resolutionData = await dataAggregation.aggregateResolutionTimes(dateRange, filters);
      await cacheService.cacheAnalyticsData(cacheKey, resolutionData);
    }

    res.json({
      success: true,
      data: resolutionData,
      filters: { dateRange, category },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /resolution-times:', error.message);
    res.status(500).json({
      error: {
        code: 'RESOLUTION_TIME_ERROR',
        message: 'Failed to generate resolution time analysis',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/analytics/export/csv
 * Export analytics data as CSV
 */
router.post('/export/csv', async (req, res) => {
  try {
    const { 
      dataType, 
      dateRange, 
      filters = {},
      includeDetails = false 
    } = req.body;

    if (!dataType || !dateRange) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EXPORT_REQUEST',
          message: 'dataType and dateRange are required for export',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get the analytics data based on dataType
    let analyticsData;
    const parsedDateRange = {
      startDate: new Date(dateRange.startDate),
      endDate: new Date(dateRange.endDate)
    };

    switch (dataType) {
      case 'trends':
        analyticsData = await dataAggregation.aggregateTrendsByCategory(parsedDateRange, filters);
        break;
      case 'geographic':
        analyticsData = await dataAggregation.aggregateByLocation(null, { ...filters, dateRange: parsedDateRange });
        break;
      case 'drivers':
        const period = filters.period || '30d';
        analyticsData = await dataAggregation.aggregateDriverStats(period, filters);
        break;
      case 'status':
        analyticsData = await dataAggregation.aggregateStatusTransitions(parsedDateRange, filters);
        break;
      default:
        return res.status(400).json({
          error: {
            code: 'INVALID_DATA_TYPE',
            message: `Unsupported data type: ${dataType}`,
            timestamp: new Date().toISOString()
          }
        });
    }

    // Generate CSV export
    const exportResult = await exportService.generateCSV(dataType, analyticsData, {
      includeDetails,
      dateRange: parsedDateRange,
      filters
    });

    // Set appropriate headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    
    res.send(exportResult.content);

  } catch (error) {
    console.error('[ERROR] Analytics API - /export/csv:', error.message);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export CSV data',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/analytics/export/pdf
 * Export analytics data as PDF
 */
router.post('/export/pdf', async (req, res) => {
  try {
    const { 
      dataType, 
      dateRange, 
      filters = {},
      includeCharts = true 
    } = req.body;

    if (!dataType || !dateRange) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EXPORT_REQUEST',
          message: 'dataType and dateRange are required for export',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get the analytics data based on dataType
    let analyticsData;
    const parsedDateRange = {
      startDate: new Date(dateRange.startDate),
      endDate: new Date(dateRange.endDate)
    };

    switch (dataType) {
      case 'trends':
        analyticsData = await dataAggregation.aggregateTrendsByCategory(parsedDateRange, filters);
        break;
      case 'geographic':
        analyticsData = await dataAggregation.aggregateByLocation(null, { ...filters, dateRange: parsedDateRange });
        break;
      case 'drivers':
        const period = filters.period || '30d';
        analyticsData = await dataAggregation.aggregateDriverStats(period, filters);
        break;
      case 'status':
        analyticsData = await dataAggregation.aggregateStatusTransitions(parsedDateRange, filters);
        break;
      default:
        return res.status(400).json({
          error: {
            code: 'INVALID_DATA_TYPE',
            message: `Unsupported data type: ${dataType}`,
            timestamp: new Date().toISOString()
          }
        });
    }

    // Generate PDF export data
    const exportResult = await exportService.generatePDF(dataType, analyticsData, {
      includeCharts,
      dateRange: parsedDateRange,
      filters
    });

    res.json({
      success: true,
      data: exportResult,
      message: 'PDF export data generated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /export/pdf:', error.message);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export PDF data',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/cache/stats
 * Get cache statistics (admin utility)
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = await cacheService.getCacheStats();
    const status = cacheService.getStatus();
    const connectionTest = await cacheService.testConnection();
    
    res.json({
      success: true,
      data: {
        ...stats,
        status,
        connectionTest
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /cache/stats:', error.message);
    res.status(500).json({
      error: {
        code: 'CACHE_STATS_ERROR',
        message: 'Failed to retrieve cache statistics',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/analytics/cache/reconnect
 * Attempt to reconnect to Redis cache
 */
router.post('/cache/reconnect', async (req, res) => {
  try {
    console.log('[INFO] Analytics API - Cache reconnection requested by admin');
    
    const reconnectResult = await cacheService.reconnect();
    const status = cacheService.getStatus();
    
    res.json({
      success: reconnectResult,
      data: {
        reconnected: reconnectResult,
        status,
        message: reconnectResult ? 'Successfully reconnected to Redis' : 'Failed to reconnect to Redis'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /cache/reconnect:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_RECONNECT_ERROR',
        message: 'Failed to reconnect to cache',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/analytics/cache
 * Clear analytics cache (admin utility)
 */
router.delete('/cache', async (req, res) => {
  try {
    const { pattern = '*' } = req.query;
    
    const deletedCount = await cacheService.invalidateCache(pattern);
    
    res.json({
      success: true,
      data: {
        deletedKeys: deletedCount,
        pattern
      },
      message: `Cleared ${deletedCount} cache entries`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - DELETE /cache:', error.message);
    res.status(500).json({
      error: {
        code: 'CACHE_CLEAR_ERROR',
        message: 'Failed to clear cache',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/status-transitions
 * Get detailed status transition analytics and workflow patterns
 */
router.get('/status-transitions', async (req, res) => {
  try {
    const { startDate, endDate, category = 'all' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'startDate and endDate are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    const filters = { category };

    const cacheKey = cacheService.generateCacheKey('status-transitions', filters, dateRange);
    let transitionData = await cacheService.getCachedData(cacheKey);

    if (!transitionData) {
      // Get reports for the date range
      const matchCriteria = {
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };

      if (category !== 'all') {
        matchCriteria.category = category;
      }

      const reports = await Report.find(matchCriteria).select('status statusHistory category createdAt updatedAt');
      
      // Generate comprehensive status analytics
      transitionData = await analyticsEngine.generateStatusAnalytics(reports);
      
      await cacheService.cacheAnalyticsData(cacheKey, transitionData, 300); // 5 minute cache
    }

    res.json({
      success: true,
      data: transitionData,
      filters: { dateRange, category },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /status-transitions:', error.message);
    res.status(500).json({
      error: {
        code: 'STATUS_TRANSITION_ERROR',
        message: 'Failed to generate status transition analytics',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/workflow-timeline
 * Get workflow timeline visualization data
 */
router.get('/workflow-timeline', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      category = 'all', 
      groupBy = 'day',
      maxReports = 100 
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'startDate and endDate are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    const options = { groupBy, category, maxReports: parseInt(maxReports) };

    const cacheKey = cacheService.generateCacheKey('workflow-timeline', options, dateRange);
    let timelineData = await cacheService.getCachedData(cacheKey);

    if (!timelineData) {
      // Get reports with status history for timeline analysis
      const matchCriteria = {
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        statusHistory: { $exists: true, $ne: [] }
      };

      if (category !== 'all') {
        matchCriteria.category = category;
      }

      const reports = await Report.find(matchCriteria)
        .select('_id status statusHistory category createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(maxReports));
      
      // Generate workflow timeline
      timelineData = await analyticsEngine.generateWorkflowTimeline(reports, options);
      
      await cacheService.cacheAnalyticsData(cacheKey, timelineData, 600); // 10 minute cache
    }

    res.json({
      success: true,
      data: timelineData,
      options,
      filters: { dateRange, category },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /workflow-timeline:', error.message);
    res.status(500).json({
      error: {
        code: 'WORKFLOW_TIMELINE_ERROR',
        message: 'Failed to generate workflow timeline',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/workflow-bottlenecks
 * Get workflow bottleneck analysis
 */
router.get('/workflow-bottlenecks', async (req, res) => {
  try {
    const { startDate, endDate, category = 'all', severity = 'all' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'startDate and endDate are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
    const filters = { category, severity };

    const cacheKey = cacheService.generateCacheKey('workflow-bottlenecks', filters, dateRange);
    let bottleneckData = await cacheService.getCachedData(cacheKey);

    if (!bottleneckData) {
      // Get reports with status history
      const matchCriteria = {
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        statusHistory: { $exists: true, $ne: [] }
      };

      if (category !== 'all') {
        matchCriteria.category = category;
      }

      const reports = await Report.find(matchCriteria)
        .select('_id status statusHistory category createdAt updatedAt');
      
      // Generate workflow timeline to get bottleneck analysis
      const timelineData = await analyticsEngine.generateWorkflowTimeline(reports, { category });
      
      // Filter bottlenecks by severity if specified
      let bottlenecks = timelineData.bottlenecks;
      if (severity !== 'all') {
        const severityThreshold = severity === 'high' ? 70 : severity === 'medium' ? 40 : 0;
        bottlenecks = bottlenecks.filter(b => b.severity >= severityThreshold);
      }

      bottleneckData = {
        bottlenecks,
        summary: {
          totalBottlenecks: bottlenecks.length,
          highSeverity: bottlenecks.filter(b => b.severity >= 70).length,
          mediumSeverity: bottlenecks.filter(b => b.severity >= 40 && b.severity < 70).length,
          lowSeverity: bottlenecks.filter(b => b.severity < 40).length
        },
        efficiencyMetrics: timelineData.efficiencyMetrics
      };
      
      await cacheService.cacheAnalyticsData(cacheKey, bottleneckData, 900); // 15 minute cache
    }

    res.json({
      success: true,
      data: bottleneckData,
      filters: { dateRange, category, severity },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /workflow-bottlenecks:', error.message);
    res.status(500).json({
      error: {
        code: 'WORKFLOW_BOTTLENECK_ERROR',
        message: 'Failed to generate workflow bottleneck analysis',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/analytics/health
 * Health check endpoint for analytics services
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      analytics: true,
      database: 'unknown',
      cache: 'unknown',
      timestamp: new Date().toISOString(),
      systemHealth: {
        database: 'connected',
        cache: 'checking',
        dataFreshness: 0
      }
    };

    // Test database connection with timeout
    try {
      const startTime = Date.now();
      await Promise.race([
        Report.countDocuments().limit(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      health.database = 'connected';
      health.systemHealth.database = responseTime > 2000 ? 'slow' : 'connected';
      health.systemHealth.responseTime = responseTime;
      
    } catch (dbError) {
      health.database = 'disconnected';
      health.systemHealth.database = 'disconnected';
      health.databaseError = dbError.message;
    }

    // Check cache availability with detailed status
    try {
      const cacheStatus = cacheService.getStatus();
      const connectionTest = await cacheService.testConnection();
      
      health.cache = cacheStatus;
      health.cacheTest = connectionTest;
      
      if (cacheStatus.enabled && cacheStatus.connected) {
        health.systemHealth.cache = 'available';
      } else if (cacheStatus.enabled && !cacheStatus.connected) {
        health.systemHealth.cache = 'unavailable';
      } else {
        health.systemHealth.cache = 'disabled';
      }
      
    } catch (cacheError) {
      health.systemHealth.cache = 'error';
      health.cacheError = cacheError.message;
    }

    // Check data freshness (time since last report)
    try {
      const latestReport = await Report.findOne().sort({ createdAt: -1 }).select('createdAt');
      if (latestReport) {
        const minutesSinceLatest = Math.floor((Date.now() - latestReport.createdAt.getTime()) / (1000 * 60));
        health.systemHealth.dataFreshness = minutesSinceLatest;
      }
    } catch (freshnessError) {
      console.warn('[WARN] Analytics Health - Data freshness check failed:', freshnessError.message);
    }

    // Determine overall health status
    const isHealthy = health.database === 'connected';
    const status = isHealthy ? 200 : 503;
    
    res.status(status).json({
      success: isHealthy,
      data: health
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /health:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Health check failed',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;