import mongoose from 'mongoose';
import Report from '../models/report.js';
import User from '../models/User.js';

/**
 * Data Aggregation Service - Optimized MongoDB aggregation pipelines for analytics
 * Handles complex data aggregation operations with performance optimization
 */
class DataAggregationService {
  constructor() {
    this.validCategories = ['recyclable', 'illegal_dumping', 'hazardous_waste'];
    this.validStatuses = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Rejected'];
  }

  /**
   * Aggregate trend data by category and date range
   * @param {Object} dateRange - { startDate, endDate }
   * @param {Object} filters - Optional filters { category, status }
   * @returns {Promise<Array>} Aggregated trend data
   */
  async aggregateTrendsByCategory(dateRange, filters = {}) {
    try {
      const { startDate, endDate } = this.validateDateRange(dateRange);
      
      // Build match stage
      const matchStage = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (filters.category && filters.category !== 'all') {
        matchStage.category = filters.category;
      }

      if (filters.status && filters.status !== 'all') {
        matchStage.status = filters.status;
      }

      // Get raw records for data quality calculation
      const rawRecords = await Report.find(matchStage);

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              category: "$category"
            },
            count: { $sum: 1 },
            reports: {
              $push: {
                id: "$_id",
                status: "$status",
                createdAt: "$createdAt"
              }
            }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            categories: {
              $push: {
                category: "$_id.category",
                count: "$count",
                reports: "$reports"
              }
            },
            totalCount: { $sum: "$count" }
          }
        },
        { $sort: { "_id": 1 } },
        {
          $project: {
            date: "$_id",
            categories: 1,
            totalCount: 1,
            _id: 0
          }
        }
      ];

      const results = await Report.aggregate(pipeline);
      return this.formatTrendResults(results, rawRecords);

    } catch (error) {
      console.error('[ERROR] DataAggregation - aggregateTrendsByCategory:', error.message);
      throw new Error(`Trend aggregation failed: ${error.message}`);
    }
  }

  /**
   * Aggregate status transitions and workflow analytics
   * @param {Object} dateRange - Date range for analysis
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Status transition analytics
   */
  async aggregateStatusTransitions(dateRange, filters = {}) {
    try {
      const { startDate, endDate } = this.validateDateRange(dateRange);
      
      const matchStage = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (filters.category && filters.category !== 'all') {
        matchStage.category = filters.category;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            averageResolutionTime: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "Completed"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null
                ]
              }
            },
            reports: {
              $push: {
                id: "$_id",
                category: "$category",
                createdAt: "$createdAt",
                updatedAt: "$updatedAt",
                resolutionTime: {
                  $cond: [
                    { $in: ["$status", ["Completed", "Rejected"]] },
                    { $subtract: ["$updatedAt", "$createdAt"] },
                    null
                  ]
                }
              }
            }
          }
        },
        {
          $project: {
            status: "$_id",
            count: 1,
            averageResolutionTime: {
              $cond: [
                { $ne: ["$averageResolutionTime", null] },
                { $divide: ["$averageResolutionTime", 1000 * 60 * 60] }, // Convert to hours
                0
              ]
            },
            reports: 1,
            _id: 0
          }
        },
        { $sort: { count: -1 } }
      ];

      const results = await Report.aggregate(pipeline);
      return this.formatStatusResults(results);

    } catch (error) {
      console.error('[ERROR] DataAggregation - aggregateStatusTransitions:', error.message);
      throw new Error(`Status aggregation failed: ${error.message}`);
    }
  }

  /**
   * Aggregate reports by geographic location
   * @param {Object} bounds - Geographic bounds { north, south, east, west }
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Geographic aggregation results
   */
  async aggregateByLocation(bounds = null, filters = {}) {
    try {
      const matchStage = {
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null }
      };

      // Add geographic bounds if provided
      if (bounds) {
        matchStage.latitude = { 
          $gte: bounds.south, 
          $lte: bounds.north 
        };
        matchStage.longitude = { 
          $gte: bounds.west, 
          $lte: bounds.east 
        };
      }

      if (filters.category && filters.category !== 'all') {
        matchStage.category = filters.category;
      }

      if (filters.dateRange) {
        const { startDate, endDate } = this.validateDateRange(filters.dateRange);
        matchStage.createdAt = { $gte: startDate, $lte: endDate };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              // Grid-based grouping for density calculation (0.01 degree grid ≈ 1km)
              lat: { $floor: { $multiply: ["$latitude", 100] } },
              lng: { $floor: { $multiply: ["$longitude", 100] } }
            },
            count: { $sum: 1 },
            categories: {
              $push: "$category"
            },
            reports: {
              $push: {
                id: "$_id",
                category: "$category",
                status: "$status",
                createdAt: "$createdAt",
                description: { $substr: ["$description", 0, 100] }
              }
            },
            avgLat: { $avg: "$latitude" },
            avgLng: { $avg: "$longitude" }
          }
        },
        {
          $project: {
            coordinates: ["$avgLng", "$avgLat"],
            incidentCount: "$count",
            density: { $multiply: ["$count", 1] }, // Simplified density calculation
            categoryBreakdown: {
              $reduce: {
                input: "$categories",
                initialValue: {},
                in: {
                  $mergeObjects: [
                    "$$value",
                    {
                      $arrayToObject: [
                        [{ k: "$$this", v: { $add: [{ $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] }, 1] } }]
                      ]
                    }
                  ]
                }
              }
            },
            reports: 1,
            _id: 0
          }
        },
        { $sort: { incidentCount: -1 } }
      ];

      const results = await Report.aggregate(pipeline);
      return this.formatGeographicResults(results);

    } catch (error) {
      console.error('[ERROR] DataAggregation - aggregateByLocation:', error.message);
      throw new Error(`Geographic aggregation failed: ${error.message}`);
    }
  }

  /**
   * Calculate density grid for heat map visualization
   * @param {Number} gridSize - Grid size in degrees (default: 0.01)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Density grid data
   */
  async calculateDensityGrid(gridSize = 0.01, filters = {}) {
    try {
      const matchStage = {
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null }
      };

      if (filters.category && filters.category !== 'all') {
        matchStage.category = filters.category;
      }

      if (filters.dateRange) {
        const { startDate, endDate } = this.validateDateRange(filters.dateRange);
        matchStage.createdAt = { $gte: startDate, $lte: endDate };
      }

      const gridMultiplier = 1 / gridSize;

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              lat: { $floor: { $multiply: ["$latitude", gridMultiplier] } },
              lng: { $floor: { $multiply: ["$longitude", gridMultiplier] } }
            },
            count: { $sum: 1 },
            centerLat: { $avg: "$latitude" },
            centerLng: { $avg: "$longitude" }
          }
        },
        {
          $project: {
            coordinates: ["$centerLng", "$centerLat"],
            intensity: "$count",
            gridSize: gridSize,
            _id: 0
          }
        },
        { $sort: { intensity: -1 } }
      ];

      return await Report.aggregate(pipeline);

    } catch (error) {
      console.error('[ERROR] DataAggregation - calculateDensityGrid:', error.message);
      throw new Error(`Density grid calculation failed: ${error.message}`);
    }
  }

  /**
   * Aggregate driver performance statistics
   * @param {String} timeframe - Timeframe for analysis ('7d', '30d', '90d')
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Driver performance statistics
   */
  async aggregateDriverStats(timeframe = '30d', filters = {}) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      // Calculate start date based on timeframe
      switch (timeframe) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      const matchStage = {
        assignedDriver: { $exists: true, $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (filters.category && filters.category !== 'all') {
        matchStage.category = filters.category;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$assignedDriver",
            assignedReports: { $sum: 1 },
            completedReports: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
            },
            rejectedReports: {
              $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] }
            },
            inProgressReports: {
              $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] }
            },
            pendingReports: {
              $sum: { $cond: [{ $eq: ["$status", "Assigned"] }, 1, 0] }
            },
            totalResolutionTime: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Completed"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  0
                ]
              }
            }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "driverInfo"
          }
        },
        {
          $project: {
            driverId: "$_id",
            assignedReports: 1,
            completedReports: 1,
            rejectedReports: 1,
            inProgressReports: 1,
            pendingReports: 1,
            completionRate: {
              $cond: [
                { $gt: ["$assignedReports", 0] },
                { $multiply: [{ $divide: ["$completedReports", "$assignedReports"] }, 100] },
                0
              ]
            },
            rejectionRate: {
              $cond: [
                { $gt: ["$assignedReports", 0] },
                { $multiply: [{ $divide: ["$rejectedReports", "$assignedReports"] }, 100] },
                0
              ]
            },
            averageResolutionTime: {
              $cond: [
                { $gt: ["$completedReports", 0] },
                { $divide: ["$totalResolutionTime", { $multiply: ["$completedReports", 1000 * 60 * 60] }] }, // Convert to hours
                0
              ]
            },
            // Privacy protection - only include performance metrics
            driverExists: { $gt: [{ $size: "$driverInfo" }, 0] },
            _id: 0
          }
        },
        { $match: { driverExists: true } }, // Only include valid drivers
        { $sort: { completionRate: -1 } }
      ];

      const results = await Report.aggregate(pipeline);
      return this.formatDriverResults(results, timeframe);

    } catch (error) {
      console.error('[ERROR] DataAggregation - aggregateDriverStats:', error.message);
      throw new Error(`Driver stats aggregation failed: ${error.message}`);
    }
  }

  /**
   * Aggregate resolution times by category
   * @param {Object} dateRange - Date range for analysis
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Resolution time statistics
   */
  async aggregateResolutionTimes(dateRange, filters = {}) {
    try {
      const { startDate, endDate } = this.validateDateRange(dateRange);
      
      const matchStage = {
        status: { $in: ["Completed", "Rejected"] },
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (filters.category && filters.category !== 'all') {
        matchStage.category = filters.category;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $addFields: {
            resolutionTime: { $subtract: ["$updatedAt", "$createdAt"] }
          }
        },
        {
          $group: {
            _id: {
              category: "$category",
              status: "$status"
            },
            count: { $sum: 1 },
            averageResolutionTime: { $avg: "$resolutionTime" },
            minResolutionTime: { $min: "$resolutionTime" },
            maxResolutionTime: { $max: "$resolutionTime" },
            totalResolutionTime: { $sum: "$resolutionTime" }
          }
        },
        {
          $project: {
            category: "$_id.category",
            status: "$_id.status",
            count: 1,
            averageResolutionTime: { $divide: ["$averageResolutionTime", 1000 * 60 * 60] }, // Convert to hours
            minResolutionTime: { $divide: ["$minResolutionTime", 1000 * 60 * 60] },
            maxResolutionTime: { $divide: ["$maxResolutionTime", 1000 * 60 * 60] },
            _id: 0
          }
        },
        { $sort: { category: 1, status: 1 } }
      ];

      return await Report.aggregate(pipeline);

    } catch (error) {
      console.error('[ERROR] DataAggregation - aggregateResolutionTimes:', error.message);
      throw new Error(`Resolution time aggregation failed: ${error.message}`);
    }
  }

  // Helper methods for data formatting

  /**
   * Format trend aggregation results
   * @param {Array} results - Raw aggregation results
   * @param {Array} rawRecords - Raw report records for data quality
   * @returns {Object} Formatted trend data
   */
  formatTrendResults(results, rawRecords = []) {
    return {
      totalDays: results.length,
      totalIncidents: results.reduce((sum, day) => sum + day.totalCount, 0),
      dailyTrends: results.map(day => ({
        date: day.date,
        total: day.totalCount,
        categories: day.categories.reduce((acc, cat) => {
          acc[cat.category] = cat.count;
          return acc;
        }, {})
      })),
      categoryTotals: results.reduce((totals, day) => {
        day.categories.forEach(cat => {
          totals[cat.category] = (totals[cat.category] || 0) + cat.count;
        });
        return totals;
      }, {}),
      rawRecords: rawRecords
    };
  }

  /**
   * Format status aggregation results
   * @param {Array} results - Raw status results
   * @returns {Object} Formatted status analytics
   */
  formatStatusResults(results) {
    const totalReports = results.reduce((sum, status) => sum + status.count, 0);
    
    return {
      totalReports,
      statusDistribution: results.map(status => ({
        ...status,
        percentage: totalReports > 0 ? Math.round((status.count / totalReports) * 100) : 0
      })),
      summary: {
        completionRate: this.calculateStatusPercentage(results, 'Completed', totalReports),
        rejectionRate: this.calculateStatusPercentage(results, 'Rejected', totalReports),
        inProgressRate: this.calculateStatusPercentage(results, 'In Progress', totalReports),
        pendingRate: this.calculateStatusPercentage(results, 'Pending', totalReports)
      }
    };
  }

  /**
   * Format geographic aggregation results
   * @param {Array} results - Raw geographic results
   * @returns {Object} Formatted geographic data
   */
  formatGeographicResults(results) {
    return {
      totalLocations: results.length,
      totalIncidents: results.reduce((sum, loc) => sum + loc.incidentCount, 0),
      locations: results.map(location => ({
        coordinates: location.coordinates,
        incidentCount: location.incidentCount,
        density: Math.round(location.density * 100) / 100,
        categoryBreakdown: location.categoryBreakdown || {},
        topReports: location.reports.slice(0, 5) // Limit to top 5 reports per location
      }))
    };
  }

  /**
   * Format driver performance results
   * @param {Array} results - Raw driver results
   * @param {String} timeframe - Analysis timeframe
   * @returns {Object} Formatted driver performance data
   */
  formatDriverResults(results, timeframe) {
    return {
      timeframe,
      driverCount: results.length,
      totalAssigned: results.reduce((sum, driver) => sum + driver.assignedReports, 0),
      totalCompleted: results.reduce((sum, driver) => sum + driver.completedReports, 0),
      systemAverages: {
        completionRate: results.length > 0 
          ? Math.round(results.reduce((sum, driver) => sum + driver.completionRate, 0) / results.length)
          : 0,
        rejectionRate: results.length > 0
          ? Math.round(results.reduce((sum, driver) => sum + driver.rejectionRate, 0) / results.length)
          : 0,
        averageResolutionTime: results.length > 0
          ? Math.round(results.reduce((sum, driver) => sum + driver.averageResolutionTime, 0) / results.length)
          : 0
      },
      drivers: results.map(driver => ({
        driverId: driver.driverId,
        assignedReports: driver.assignedReports,
        completedReports: driver.completedReports,
        rejectedReports: driver.rejectedReports,
        inProgressReports: driver.inProgressReports,
        pendingReports: driver.pendingReports,
        completionRate: Math.round(driver.completionRate),
        rejectionRate: Math.round(driver.rejectionRate),
        averageResolutionTime: Math.round(driver.averageResolutionTime * 100) / 100
      }))
    };
  }

  // Utility methods

  /**
   * Add pagination to aggregation pipeline
   * @param {Array} pipeline - MongoDB aggregation pipeline
   * @param {Object} pagination - Pagination options { page, limit }
   * @returns {Array} Pipeline with pagination stages
   */
  addPagination(pipeline, pagination = {}) {
    const { page = 1, limit = 100 } = pagination;
    const skip = (page - 1) * limit;

    // Add pagination stages
    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );

    return pipeline;
  }

  /**
   * Get paginated results with total count
   * @param {String} collection - Collection name
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated results with metadata
   */
  async getPaginatedResults(collection, pipeline, pagination = {}) {
    try {
      const { page = 1, limit = 100 } = pagination;
      const skip = (page - 1) * limit;

      // Create count pipeline (without pagination)
      const countPipeline = [...pipeline, { $count: "total" }];
      
      // Create data pipeline (with pagination)
      const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

      // Execute both pipelines
      const [countResult, dataResult] = await Promise.all([
        Report.aggregate(countPipeline),
        Report.aggregate(dataPipeline)
      ]);

      const total = countResult.length > 0 ? countResult[0].total : 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('[ERROR] DataAggregation - getPaginatedResults:', error.message);
      throw new Error(`Pagination failed: ${error.message}`);
    }
  }

  /**
   * Optimize aggregation pipeline for large datasets
   * @param {Array} pipeline - Original pipeline
   * @param {Object} options - Optimization options
   * @returns {Array} Optimized pipeline
   */
  optimizePipeline(pipeline, options = {}) {
    const { 
      addIndexHints = true, 
      limitEarlyStages = true,
      maxDocuments = 50000,
      useAllowDiskUse = true 
    } = options;

    const optimizedPipeline = [...pipeline];

    // Add early limiting for performance
    if (limitEarlyStages && maxDocuments) {
      // Find the first $match stage and add limit after it
      const matchIndex = optimizedPipeline.findIndex(stage => stage.$match);
      if (matchIndex !== -1) {
        optimizedPipeline.splice(matchIndex + 1, 0, { $limit: maxDocuments });
      }
    }

    // Add index hints for common queries
    if (addIndexHints) {
      const matchStage = optimizedPipeline.find(stage => stage.$match);
      if (matchStage && matchStage.$match.createdAt) {
        // Hint to use the date-based index
        optimizedPipeline.unshift({ $hint: { createdAt: 1, category: 1, status: 1 } });
      }
    }

    return optimizedPipeline;
  }

  /**
   * Execute aggregation with performance monitoring and enhanced error handling
   * @param {String} collection - Collection name
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Results with performance metrics
   */
  async executeWithPerformanceMonitoring(collection, pipeline, options = {}) {
    const startTime = Date.now();
    const { timeout = 30000, allowDiskUse = true, maxRetries = 2 } = options;

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        // Validate inputs
        if (!Array.isArray(pipeline)) {
          throw new Error('Pipeline must be an array');
        }

        if (pipeline.length === 0) {
          throw new Error('Pipeline cannot be empty');
        }

        // Add performance optimizations
        const optimizedPipeline = this.optimizePipeline(pipeline, options);

        // Execute with timeout and disk use allowance
        const aggregationOptions = {
          allowDiskUse,
          maxTimeMS: timeout
        };

        console.log(`[INFO] DataAggregation - Executing aggregation (attempt ${attempt + 1}/${maxRetries + 1})`);

        const results = await Report.aggregate(optimizedPipeline, aggregationOptions);
        const executionTime = Date.now() - startTime;

        // Validate results
        if (!Array.isArray(results)) {
          throw new Error('Aggregation returned invalid results (not an array)');
        }

        // Performance analysis
        const performanceMetrics = {
          executionTime,
          documentCount: results.length,
          pipelineStages: optimizedPipeline.length,
          attempt: attempt + 1,
          optimizationsApplied: true
        };

        // Log performance warnings
        if (executionTime > 10000) { // 10 seconds
          console.warn(`[WARN] DataAggregation - Slow query detected: ${executionTime}ms (${results.length} results)`);
          performanceMetrics.performanceWarning = 'Slow execution time';
        }

        if (results.length > 50000) {
          console.warn(`[WARN] DataAggregation - Large result set: ${results.length} documents`);
          performanceMetrics.performanceWarning = 'Large result set';
        }

        // Success - return results
        return {
          data: results,
          performance: performanceMetrics,
          success: true
        };

      } catch (error) {
        attempt++;
        lastError = error;
        const executionTime = Date.now() - startTime;
        
        console.error(`[ERROR] DataAggregation - Attempt ${attempt} failed after ${executionTime}ms:`, error.message);

        // Handle specific error types
        if (error.code === 50 || error.message.includes('timeout')) {
          if (attempt <= maxRetries) {
            console.log(`[INFO] DataAggregation - Retrying with increased timeout (attempt ${attempt + 1})`);
            options.timeout = Math.min(timeout * 1.5, 60000); // Increase timeout, max 60s
            continue;
          } else {
            throw new Error(`Query timeout after ${executionTime}ms and ${maxRetries} retries. Consider adding filters or pagination.`);
          }
        }

        if (error.code === 16389 || error.message.includes('BSONObj size')) {
          throw new Error('Result set too large. Please add filters or use pagination to reduce data size.');
        }

        if (error.code === 16020 || error.message.includes('PlanExecutor error')) {
          if (attempt <= maxRetries) {
            console.log(`[INFO] DataAggregation - Retrying with simplified pipeline (attempt ${attempt + 1})`);
            // Try with a simpler pipeline on retry
            continue;
          }
        }

        // If this is the last attempt, throw the error
        if (attempt > maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All attempts failed
    const totalTime = Date.now() - startTime;
    console.error(`[ERROR] DataAggregation - All ${maxRetries + 1} attempts failed after ${totalTime}ms`);
    
    throw new Error(`Aggregation failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get dataset size estimation
   * @param {Object} matchCriteria - Match criteria for estimation
   * @returns {Promise<Object>} Size estimation
   */
  async estimateDatasetSize(matchCriteria = {}) {
    try {
      const pipeline = [
        { $match: matchCriteria },
        {
          $group: {
            _id: null,
            totalDocuments: { $sum: 1 },
            avgDocumentSize: { $avg: { $bsonSize: "$$ROOT" } },
            dateRange: {
              $push: {
                min: { $min: "$createdAt" },
                max: { $max: "$createdAt" }
              }
            }
          }
        }
      ];

      const results = await Report.aggregate(pipeline);
      
      if (results.length === 0) {
        return {
          totalDocuments: 0,
          estimatedSizeMB: 0,
          recommendedPageSize: 100,
          processingComplexity: 'low'
        };
      }

      const stats = results[0];
      const estimatedSizeMB = (stats.totalDocuments * stats.avgDocumentSize) / (1024 * 1024);
      
      // Recommend page size based on dataset size
      let recommendedPageSize = 100;
      let processingComplexity = 'low';
      
      if (stats.totalDocuments > 100000) {
        recommendedPageSize = 50;
        processingComplexity = 'high';
      } else if (stats.totalDocuments > 10000) {
        recommendedPageSize = 75;
        processingComplexity = 'medium';
      }

      return {
        totalDocuments: stats.totalDocuments,
        estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100,
        recommendedPageSize,
        processingComplexity,
        avgDocumentSize: Math.round(stats.avgDocumentSize)
      };

    } catch (error) {
      console.error('[ERROR] DataAggregation - estimateDatasetSize:', error.message);
      return {
        totalDocuments: 0,
        estimatedSizeMB: 0,
        recommendedPageSize: 100,
        processingComplexity: 'unknown'
      };
    }
  }

  /**
   * Create progress indicator for long-running operations
   * @param {String} operationId - Unique operation identifier
   * @param {Number} totalSteps - Total number of steps
   * @returns {Object} Progress tracker
   */
  createProgressTracker(operationId, totalSteps) {
    const startTime = Date.now();
    let currentStep = 0;

    return {
      operationId,
      totalSteps,
      
      updateProgress: (step, message = '') => {
        currentStep = step;
        const progress = Math.round((step / totalSteps) * 100);
        const elapsed = Date.now() - startTime;
        const estimatedTotal = totalSteps > 0 ? (elapsed / step) * totalSteps : 0;
        const remaining = estimatedTotal - elapsed;

        console.log(`[PROGRESS] ${operationId}: ${progress}% (${step}/${totalSteps}) - ${message}`);
        
        return {
          progress,
          currentStep: step,
          totalSteps,
          elapsedTime: elapsed,
          estimatedRemaining: remaining > 0 ? remaining : 0,
          message
        };
      },

      complete: (message = 'Operation completed') => {
        const totalTime = Date.now() - startTime;
        console.log(`[COMPLETE] ${operationId}: ${message} (${totalTime}ms)`);
        
        return {
          progress: 100,
          currentStep: totalSteps,
          totalSteps,
          elapsedTime: totalTime,
          estimatedRemaining: 0,
          message
        };
      }
    };
  }

  /**
   * Validate date range with comprehensive error handling
   * @param {Object} dateRange - { startDate, endDate }
   * @returns {Object} Validated date range with additional metadata
   */
  validateDateRange(dateRange) {
    try {
      if (!dateRange) {
        throw new Error('Date range object is required');
      }

      if (!dateRange.startDate || !dateRange.endDate) {
        throw new Error('Both startDate and endDate are required');
      }

      let startDate, endDate;

      // Handle different date input formats
      try {
        startDate = new Date(dateRange.startDate);
        endDate = new Date(dateRange.endDate);
      } catch (parseError) {
        throw new Error(`Date parsing failed: ${parseError.message}`);
      }

      // Validate parsed dates
      if (isNaN(startDate.getTime())) {
        throw new Error(`Invalid startDate format: ${dateRange.startDate}`);
      }

      if (isNaN(endDate.getTime())) {
        throw new Error(`Invalid endDate format: ${dateRange.endDate}`);
      }

      // Logical validation
      if (startDate > endDate) {
        throw new Error('Start date cannot be after end date');
      }

      // Check for reasonable date ranges
      const now = new Date();
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());

      if (startDate > oneYearFromNow) {
        console.warn('[WARN] DataAggregation - Start date is more than one year in the future');
      }

      if (endDate < tenYearsAgo) {
        console.warn('[WARN] DataAggregation - End date is more than ten years in the past');
      }

      // Calculate range duration for performance warnings
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

      if (durationDays > 365) {
        console.warn(`[WARN] DataAggregation - Large date range: ${durationDays} days. Consider pagination for better performance.`);
      }

      return { 
        startDate, 
        endDate,
        metadata: {
          durationDays,
          durationMs,
          isLargeRange: durationDays > 365,
          isRecentRange: startDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      };

    } catch (error) {
      console.error('[ERROR] DataAggregation - validateDateRange:', error.message);
      throw new Error(`Date range validation failed: ${error.message}`);
    }
  }

  /**
   * Calculate percentage for specific status
   * @param {Array} results - Status results
   * @param {String} status - Status to calculate percentage for
   * @param {Number} total - Total count
   * @returns {Number} Percentage
   */
  calculateStatusPercentage(results, status, total) {
    const statusData = results.find(r => r.status === status);
    return statusData && total > 0 ? Math.round((statusData.count / total) * 100) : 0;
  }
}

export default DataAggregationService;