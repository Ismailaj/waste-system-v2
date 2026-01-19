import express from 'express';
import AnalyticsEngine from '../utils/analyticsEngine.js';
import DataAggregationService from '../services/dataAggregation.js';
import CacheService from '../services/cacheService.js';
import ExportService from '../services/exportService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Report from '../models/report.js';

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
    const { startDate, endDate, category = 'all', status = 'all' } = req.query;

    // Validate required parameters
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
    const filters = { category, status };

    // Check cache first
    const cacheKey = cacheService.generateCacheKey('trends', filters, dateRange);
    let trendData = await cacheService.getCachedData(cacheKey);

    if (!trendData) {
      // Generate fresh data
      trendData = await dataAggregation.aggregateTrendsByCategory(dateRange, filters);
      
      // Cache the results
      await cacheService.cacheAnalyticsData(cacheKey, trendData);
    }

    res.json({
      success: true,
      data: trendData,
      filters: { dateRange, category, status },
      cached: !!trendData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /trends:', error.message);
    res.status(500).json({
      error: {
        code: 'TREND_ANALYSIS_ERROR',
        message: 'Failed to generate trend analysis',
        details: error.message,
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
      period1Data.dailyData || [],
      period2Data.dailyData || []
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
    let geographicData = await cacheService.getCachedData(cacheKey);

    if (!geographicData) {
      geographicData = await dataAggregation.aggregateByLocation(bounds, filters);
      await cacheService.cacheAnalyticsData(cacheKey, geographicData);
    }

    res.json({
      success: true,
      data: geographicData,
      filters: { bounds, category, dateRange: filters.dateRange },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /geographic:', error.message);
    res.status(500).json({
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
 * Get driver performance metrics
 */
router.get('/drivers', async (req, res) => {
  try {
    const { 
      metric = 'completion_rate', 
      period = '30d',
      driverId = null 
    } = req.query;

    const cacheKey = cacheService.generateCacheKey('drivers', { metric, period, driverId });
    let driverData = await cacheService.getCachedData(cacheKey);

    if (!driverData) {
      driverData = await dataAggregation.aggregateDriverStats(period, {});
      await cacheService.cacheAnalyticsData(cacheKey, driverData);
    }

    // Filter by specific driver if requested
    if (driverId && driverData.drivers) {
      const specificDriver = driverData.drivers.find(d => d.driverId.toString() === driverId);
      if (specificDriver) {
        driverData = {
          ...driverData,
          drivers: [specificDriver],
          driverCount: 1
        };
      } else {
        return res.status(404).json({
          error: {
            code: 'DRIVER_NOT_FOUND',
            message: 'Driver not found or has no assigned reports in the specified period',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    res.json({
      success: true,
      data: driverData,
      filters: { metric, period, driverId },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /drivers:', error.message);
    res.status(500).json({
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
    
    res.json({
      success: true,
      data: stats,
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
 * GET /api/analytics/health
 * Health check endpoint for analytics services
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      analytics: true,
      database: false,
      cache: cacheService.isAvailable(),
      timestamp: new Date().toISOString()
    };

    // Test database connection
    try {
      await Report.countDocuments().limit(1);
      health.database = true;
    } catch (dbError) {
      health.database = false;
      health.databaseError = dbError.message;
    }

    const status = health.analytics && health.database ? 200 : 503;
    
    res.status(status).json({
      success: status === 200,
      data: health
    });

  } catch (error) {
    console.error('[ERROR] Analytics API - /health:', error.message);
    res.status(500).json({
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