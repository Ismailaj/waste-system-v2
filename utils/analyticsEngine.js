import moment from 'moment';
import Report from '../models/report.js';
import User from '../models/User.js';

/**
 * Analytics Engine - Core processing component for CleanCity analytics
 * Handles data aggregation, trend analysis, geographic processing, and performance metrics
 */
class AnalyticsEngine {
  constructor() {
    this.validStatuses = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Rejected'];
    this.validCategories = ['recyclable', 'illegal_dumping', 'hazardous_waste'];
  }

  /**
   * Generate trend data for specified date range and filters
   * @param {Object} dateRange - { startDate, endDate }
   * @param {Object} filters - { category, status }
   * @returns {Promise<Object>} Trend data with counts and percentage changes
   */
  async generateTrendData(dateRange, filters = {}) {
    try {
      const { startDate, endDate } = this.validateDateRange(dateRange);
      
      // Build match criteria
      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (filters.category && filters.category !== 'all') {
        matchCriteria.category = filters.category;
      }

      if (filters.status && filters.status !== 'all') {
        matchCriteria.status = filters.status;
      }

      // Aggregate trend data by day
      const trendData = await Report.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              category: "$category"
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.date": 1 } }
      ]);

      // Process and format trend data
      return this.processTrendData(trendData, dateRange);

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generateTrendData:', error.message);
      throw new Error(`Trend analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate percentage changes between time periods
   * @param {Array} currentPeriod - Current period data
   * @param {Array} previousPeriod - Previous period data
   * @returns {Object} Percentage change calculations
   */
  async calculatePercentageChanges(currentPeriod, previousPeriod) {
    try {
      const currentTotal = currentPeriod.reduce((sum, item) => sum + item.count, 0);
      const previousTotal = previousPeriod.reduce((sum, item) => sum + item.count, 0);

      if (previousTotal === 0) {
        return {
          percentageChange: currentTotal > 0 ? 100 : 0,
          trend: currentTotal > 0 ? 'increase' : 'stable',
          currentCount: currentTotal,
          previousCount: previousTotal
        };
      }

      const percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
      
      return {
        percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
        trend: percentageChange > 0 ? 'increase' : percentageChange < 0 ? 'decrease' : 'stable',
        currentCount: currentTotal,
        previousCount: previousTotal
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculatePercentageChanges:', error.message);
      throw new Error(`Percentage change calculation failed: ${error.message}`);
    }
  }

  /**
   * Process geographic distribution of reports
   * @param {Array} reports - Array of reports with coordinates
   * @returns {Promise<Object>} Geographic distribution data
   */
  async processGeographicDistribution(reports) {
    try {
      // Filter reports with valid coordinates
      const geocodedReports = reports.filter(report => 
        report.latitude && 
        report.longitude && 
        this.validateCoordinates(report.latitude, report.longitude)
      );

      // Group by approximate location (grid-based)
      const locationGroups = this.groupByLocation(geocodedReports);
      
      // Calculate density for each location group
      const distributionData = locationGroups.map(group => ({
        coordinates: [group.longitude, group.latitude],
        incidentCount: group.reports.length,
        category: group.category || 'mixed',
        density: this.calculateIncidentDensity(group.reports, group.area),
        reports: group.reports.map(r => ({
          id: r._id,
          category: r.category,
          status: r.status,
          createdAt: r.createdAt,
          description: r.description?.substring(0, 100) + '...'
        }))
      }));

      return {
        totalGeocoded: geocodedReports.length,
        totalReports: reports.length,
        geocodingRate: Math.round((geocodedReports.length / reports.length) * 100),
        distributionData
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - processGeographicDistribution:', error.message);
      throw new Error(`Geographic processing failed: ${error.message}`);
    }
  }

  /**
   * Calculate incident density per area
   * @param {Array} incidents - Array of incidents in the area
   * @param {Number} area - Area in square kilometers
   * @returns {Number} Density (incidents per square kilometer)
   */
  calculateIncidentDensity(incidents, area = 1) {
    try {
      if (!incidents || incidents.length === 0) return 0;
      if (area <= 0) area = 1; // Default to 1 sq km if invalid area
      
      return Math.round((incidents.length / area) * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateIncidentDensity:', error.message);
      return 0;
    }
  }

  /**
   * Calculate driver performance metrics
   * @param {String} driverId - Driver ID (optional, if null returns all drivers)
   * @param {Object} dateRange - Date range for analysis
   * @returns {Promise<Object>} Driver performance metrics
   */
  async calculateDriverMetrics(driverId = null, dateRange) {
    try {
      const { startDate, endDate } = this.validateDateRange(dateRange);
      
      const matchCriteria = {
        assignedDriver: { $exists: true, $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (driverId) {
        matchCriteria.assignedDriver = driverId;
      }

      const driverStats = await Report.aggregate([
        { $match: matchCriteria },
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
            // Calculate average resolution time for completed reports
            completedReportTimes: {
              $push: {
                $cond: [
                  { $eq: ["$status", "Completed"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null
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
        }
      ]);

      // Process driver statistics
      const processedStats = await Promise.all(driverStats.map(async (stat) => {
        const completionRate = stat.assignedReports > 0 
          ? Math.round((stat.completedReports / stat.assignedReports) * 100)
          : 0;
        
        const rejectionRate = stat.assignedReports > 0
          ? Math.round((stat.rejectedReports / stat.assignedReports) * 100)
          : 0;

        // Calculate average resolution time (in hours)
        const validTimes = stat.completedReportTimes.filter(time => time !== null);
        const averageResolutionTime = validTimes.length > 0
          ? Math.round((validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length) / (1000 * 60 * 60))
          : 0;

        return {
          driverId: stat._id,
          // Privacy protection - only include performance metrics
          assignedReports: stat.assignedReports,
          completedReports: stat.completedReports,
          rejectedReports: stat.rejectedReports,
          inProgressReports: stat.inProgressReports,
          completionRate,
          rejectionRate,
          averageResolutionTime, // in hours
          period: { startDate, endDate }
        };
      }));

      return {
        driverCount: processedStats.length,
        metrics: processedStats,
        summary: {
          totalAssigned: processedStats.reduce((sum, stat) => sum + stat.assignedReports, 0),
          totalCompleted: processedStats.reduce((sum, stat) => sum + stat.completedReports, 0),
          averageCompletionRate: processedStats.length > 0
            ? Math.round(processedStats.reduce((sum, stat) => sum + stat.completionRate, 0) / processedStats.length)
            : 0
        }
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateDriverMetrics:', error.message);
      throw new Error(`Driver metrics calculation failed: ${error.message}`);
    }
  }

  /**
   * Generate status analytics for reports
   * @param {Array} reports - Array of reports to analyze
   * @returns {Object} Status distribution and transition analytics
   */
  async generateStatusAnalytics(reports) {
    try {
      const validReports = reports.filter(report => this.validateReportData(report));
      
      // Status distribution
      const statusCounts = {};
      this.validStatuses.forEach(status => {
        statusCounts[status] = validReports.filter(r => r.status === status).length;
      });

      const totalReports = validReports.length;
      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalReports > 0 ? Math.round((count / totalReports) * 100) : 0
      }));

      // Calculate average time in each status (simplified - would need status history for full implementation)
      const completedReports = validReports.filter(r => r.status === 'Completed');
      const averageResolutionTime = completedReports.length > 0
        ? Math.round(completedReports.reduce((sum, report) => {
            return sum + (new Date(report.updatedAt) - new Date(report.createdAt));
          }, 0) / completedReports.length / (1000 * 60 * 60)) // Convert to hours
        : 0;

      return {
        totalReports,
        validReports: validReports.length,
        excludedReports: reports.length - validReports.length,
        statusDistribution,
        averageResolutionTime,
        completionRate: totalReports > 0 
          ? Math.round((statusCounts['Completed'] / totalReports) * 100)
          : 0,
        rejectionRate: totalReports > 0
          ? Math.round((statusCounts['Rejected'] / totalReports) * 100)
          : 0
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generateStatusAnalytics:', error.message);
      throw new Error(`Status analytics generation failed: ${error.message}`);
    }
  }

  /**
   * Validate report data for analytics processing
   * @param {Object} report - Report object to validate
   * @returns {Boolean} True if report is valid for analytics
   */
  validateReportData(report) {
    try {
      // Check required fields
      if (!report || !report._id || !report.createdAt || !report.category || !report.status) {
        return false;
      }

      // Validate category
      if (!this.validCategories.includes(report.category)) {
        return false;
      }

      // Validate status
      if (!this.validStatuses.includes(report.status)) {
        return false;
      }

      // Validate dates
      const createdAt = new Date(report.createdAt);
      if (isNaN(createdAt.getTime())) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ERROR] Analytics Engine - validateReportData:', error.message);
      return false;
    }
  }

  /**
   * Exclude invalid records from dataset
   * @param {Array} reports - Array of reports to filter
   * @returns {Object} { validReports, excludedCount, dataQualityScore }
   */
  excludeInvalidRecords(reports) {
    try {
      const validReports = reports.filter(report => this.validateReportData(report));
      const excludedCount = reports.length - validReports.length;
      const dataQualityScore = reports.length > 0 
        ? Math.round((validReports.length / reports.length) * 100)
        : 100;

      if (excludedCount > 0) {
        console.log(`[INFO] Analytics Engine - Excluded ${excludedCount} invalid records from ${reports.length} total records`);
      }

      return {
        validReports,
        excludedCount,
        dataQualityScore
      };
    } catch (error) {
      console.error('[ERROR] Analytics Engine - excludeInvalidRecords:', error.message);
      return {
        validReports: [],
        excludedCount: reports.length,
        dataQualityScore: 0
      };
    }
  }

  // Helper methods

  /**
   * Validate date range
   * @param {Object} dateRange - { startDate, endDate }
   * @returns {Object} Validated date range
   */
  validateDateRange(dateRange) {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      throw new Error('Invalid date range: startDate and endDate are required');
    }

    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format in date range');
    }

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    return { startDate, endDate };
  }

  /**
   * Validate coordinates
   * @param {Number} latitude - Latitude coordinate
   * @param {Number} longitude - Longitude coordinate
   * @returns {Boolean} True if coordinates are valid
   */
  validateCoordinates(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Group reports by approximate location (grid-based)
   * @param {Array} reports - Reports with coordinates
   * @returns {Array} Location groups
   */
  groupByLocation(reports) {
    const gridSize = 0.01; // Approximately 1km grid
    const locationMap = new Map();

    reports.forEach(report => {
      const gridLat = Math.floor(report.latitude / gridSize) * gridSize;
      const gridLng = Math.floor(report.longitude / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;

      if (!locationMap.has(key)) {
        locationMap.set(key, {
          latitude: gridLat + (gridSize / 2),
          longitude: gridLng + (gridSize / 2),
          reports: [],
          area: gridSize * gridSize * 111 * 111 // Approximate area in sq km
        });
      }

      locationMap.get(key).reports.push(report);
    });

    return Array.from(locationMap.values());
  }

  /**
   * Process trend data into formatted structure
   * @param {Array} trendData - Raw aggregated trend data
   * @param {Object} dateRange - Date range for analysis
   * @returns {Object} Processed trend data
   */
  processTrendData(trendData, dateRange) {
    const processedData = {
      dateRange,
      totalIncidents: 0,
      categoryBreakdown: {},
      dailyTrends: []
    };

    // Initialize category breakdown
    this.validCategories.forEach(category => {
      processedData.categoryBreakdown[category] = 0;
    });

    // Process daily trends
    const dailyMap = new Map();
    
    trendData.forEach(item => {
      const date = item._id.date;
      const category = item._id.category;
      const count = item.count;

      processedData.totalIncidents += count;
      processedData.categoryBreakdown[category] = (processedData.categoryBreakdown[category] || 0) + count;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, total: 0, categories: {} });
      }

      const dayData = dailyMap.get(date);
      dayData.total += count;
      dayData.categories[category] = count;
    });

    processedData.dailyTrends = Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    return processedData;
  }
}

export default AnalyticsEngine;