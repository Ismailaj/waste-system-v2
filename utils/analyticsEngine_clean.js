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
   * Calculate comprehensive driver performance metrics
   * @param {String} driverId - Driver ID (optional, if null returns all drivers)
   * @param {Object} dateRange - Date range for analysis
   * @returns {Promise<Object>} Enhanced driver performance metrics
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
            pendingReports: {
              $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] }
            },
            // Calculate resolution times for completed reports
            completedReportTimes: {
              $push: {
                $cond: [
                  { $eq: ["$status", "Completed"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null
                ]
              }
            },
            // Track category distribution
            recyclableReports: {
              $sum: { $cond: [{ $eq: ["$category", "recyclable"] }, 1, 0] }
            },
            illegalDumpingReports: {
              $sum: { $cond: [{ $eq: ["$category", "illegal_dumping"] }, 1, 0] }
            },
            hazardousWasteReports: {
              $sum: { $cond: [{ $eq: ["$category", "hazardous_waste"] }, 1, 0] }
            },
            // Track assignment dates for workload analysis
            assignmentDates: { $push: "$assignedAt" },
            // Track report creation dates for trend analysis
            reportDates: { $push: "$createdAt" }
          }
        }
      ]);

      // Process enhanced driver statistics
      const processedStats = await Promise.all(driverStats.map(async (stat) => {
        return this.processDriverPerformanceData(stat, { startDate, endDate });
      }));

      // Calculate system-wide performance benchmarks
      const benchmarks = this.calculatePerformanceBenchmarks(processedStats);

      return {
        driverCount: processedStats.length,
        metrics: processedStats,
        benchmarks,
        summary: {
          totalAssigned: processedStats.reduce((sum, stat) => sum + stat.assignedReports, 0),
          totalCompleted: processedStats.reduce((sum, stat) => sum + stat.completedReports, 0),
          averageCompletionRate: processedStats.length > 0
            ? Math.round(processedStats.reduce((sum, stat) => sum + stat.completionRate, 0) / processedStats.length)
            : 0,
          averageResolutionTime: processedStats.length > 0
            ? Math.round(processedStats.reduce((sum, stat) => sum + stat.averageResolutionTime, 0) / processedStats.length)
            : 0
        }
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateDriverMetrics:', error.message);
      throw new Error(`Driver metrics calculation failed: ${error.message}`);
    }
  }

  /**
   * Process individual driver performance data with enhanced calculations
   * @param {Object} stat - Raw driver statistics from aggregation
   * @param {Object} period - Analysis period
   * @returns {Object} Processed driver performance metrics
   */
  processDriverPerformanceData(stat, period) {
    try {
      // Basic completion and rejection rates
      const completionRate = stat.assignedReports > 0 
        ? Math.round((stat.completedReports / stat.assignedReports) * 100)
        : 0;
      
      const rejectionRate = stat.assignedReports > 0
        ? Math.round((stat.rejectedReports / stat.assignedReports) * 100)
        : 0;

      // Calculate resolution time statistics
      const validTimes = stat.completedReportTimes.filter(time => time !== null && time > 0);
      const resolutionTimeStats = this.calculateResolutionTimeStats(validTimes);

      // Calculate workload distribution
      const workloadStats = this.calculateWorkloadDistribution(stat);

      // Calculate efficiency metrics
      const efficiencyMetrics = this.calculateEfficiencyMetrics(stat, resolutionTimeStats);

      // Privacy protection - return only performance metrics, no personal information
      return {
        driverId: stat._id,
        // Core performance metrics
        assignedReports: stat.assignedReports,
        completedReports: stat.completedReports,
        rejectedReports: stat.rejectedReports,
        inProgressReports: stat.inProgressReports,
        pendingReports: stat.pendingReports,
        
        // Performance rates
        completionRate,
        rejectionRate,
        inProgressRate: stat.assignedReports > 0 
          ? Math.round((stat.inProgressReports / stat.assignedReports) * 100)
          : 0,

        // Resolution time analytics
        averageResolutionTime: resolutionTimeStats.average,
        medianResolutionTime: resolutionTimeStats.median,
        minResolutionTime: resolutionTimeStats.min,
        maxResolutionTime: resolutionTimeStats.max,
        resolutionTimeVariance: resolutionTimeStats.variance,

        // Workload distribution
        categoryDistribution: workloadStats.categoryDistribution,
        workloadBalance: workloadStats.balance,

        // Efficiency metrics
        reportsPerDay: efficiencyMetrics.reportsPerDay,
        productivityScore: efficiencyMetrics.productivityScore,
        consistencyScore: efficiencyMetrics.consistencyScore,

        // Assignment tracking
        assignmentAccuracy: this.calculateAssignmentAccuracy(stat),
        
        // Analysis period
        period
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - processDriverPerformanceData:', error.message);
      // Return basic metrics on error to maintain system stability
      return {
        driverId: stat._id,
        assignedReports: stat.assignedReports || 0,
        completedReports: stat.completedReports || 0,
        rejectedReports: stat.rejectedReports || 0,
        completionRate: 0,
        rejectionRate: 0,
        averageResolutionTime: 0,
        period,
        error: 'Processing failed - basic metrics only'
      };
    }
  }

  /**
   * Calculate detailed resolution time statistics
   * @param {Array} resolutionTimes - Array of resolution times in milliseconds
   * @returns {Object} Resolution time statistics
   */
  calculateResolutionTimeStats(resolutionTimes) {
    try {
      if (!resolutionTimes || resolutionTimes.length === 0) {
        return {
          average: 0,
          median: 0,
          min: 0,
          max: 0,
          variance: 0,
          count: 0
        };
      }

      // Convert to hours and sort
      const timesInHours = resolutionTimes
        .map(time => time / (1000 * 60 * 60))
        .sort((a, b) => a - b);

      const count = timesInHours.length;
      const sum = timesInHours.reduce((acc, time) => acc + time, 0);
      const average = sum / count;

      // Calculate median
      const median = count % 2 === 0
        ? (timesInHours[count / 2 - 1] + timesInHours[count / 2]) / 2
        : timesInHours[Math.floor(count / 2)];

      // Calculate variance
      const variance = count > 1
        ? timesInHours.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / (count - 1)
        : 0;

      return {
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        min: Math.round(timesInHours[0] * 100) / 100,
        max: Math.round(timesInHours[count - 1] * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        count
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateResolutionTimeStats:', error.message);
      return { average: 0, median: 0, min: 0, max: 0, variance: 0, count: 0 };
    }
  }

  /**
   * Calculate workload distribution across categories
   * @param {Object} stat - Driver statistics
   * @returns {Object} Workload distribution metrics
   */
  calculateWorkloadDistribution(stat) {
    try {
      const totalReports = stat.assignedReports || 0;
      
      if (totalReports === 0) {
        return {
          categoryDistribution: {
            recyclable: 0,
            illegal_dumping: 0,
            hazardous_waste: 0
          },
          balance: 100 // Perfect balance when no reports
        };
      }

      const categoryDistribution = {
        recyclable: Math.round((stat.recyclableReports / totalReports) * 100),
        illegal_dumping: Math.round((stat.illegalDumpingReports / totalReports) * 100),
        hazardous_waste: Math.round((stat.hazardousWasteReports / totalReports) * 100)
      };

      // Calculate workload balance (how evenly distributed across categories)
      const expectedPercentage = 100 / 3; // 33.33% for perfect balance
      const deviations = Object.values(categoryDistribution)
        .map(percentage => Math.abs(percentage - expectedPercentage));
      const averageDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
      const balance = Math.max(0, Math.round(100 - (averageDeviation * 3))); // Scale to 0-100

      return {
        categoryDistribution,
        balance
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateWorkloadDistribution:', error.message);
      return {
        categoryDistribution: { recyclable: 0, illegal_dumping: 0, hazardous_waste: 0 },
        balance: 0
      };
    }
  }

  /**
   * Calculate efficiency metrics for driver performance
   * @param {Object} stat - Driver statistics
   * @param {Object} resolutionTimeStats - Resolution time statistics
   * @returns {Object} Efficiency metrics
   */
  calculateEfficiencyMetrics(stat, resolutionTimeStats) {
    try {
      const totalReports = stat.assignedReports || 0;
      const completedReports = stat.completedReports || 0;
      
      // Calculate reports per day (assuming 30-day period for estimation)
      const reportsPerDay = Math.round((totalReports / 30) * 100) / 100;

      // Calculate productivity score (0-100) based on completion rate and volume
      const completionRate = totalReports > 0 ? (completedReports / totalReports) * 100 : 0;
      const volumeScore = Math.min(100, (totalReports / 10) * 100); // 10 reports = 100% volume score
      const productivityScore = Math.round((completionRate * 0.7) + (volumeScore * 0.3));

      // Calculate consistency score based on resolution time variance
      const consistencyScore = resolutionTimeStats.variance > 0
        ? Math.max(0, Math.round(100 - (resolutionTimeStats.variance / 10))) // Lower variance = higher consistency
        : 100;

      return {
        reportsPerDay,
        productivityScore: Math.min(100, productivityScore),
        consistencyScore: Math.min(100, consistencyScore)
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateEfficiencyMetrics:', error.message);
      return {
        reportsPerDay: 0,
        productivityScore: 0,
        consistencyScore: 0
      };
    }
  }

  /**
   * Calculate assignment accuracy metrics
   * @param {Object} stat - Driver statistics
   * @returns {Number} Assignment accuracy percentage
   */
  calculateAssignmentAccuracy(stat) {
    try {
      const totalAssigned = stat.assignedReports || 0;
      const completed = stat.completedReports || 0;
      const inProgress = stat.inProgressReports || 0;
      
      if (totalAssigned === 0) return 100;

      // Assignment accuracy = (completed + in_progress) / total_assigned
      // This measures how many assignments result in active work vs rejection
      const activeReports = completed + inProgress;
      return Math.round((activeReports / totalAssigned) * 100);

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateAssignmentAccuracy:', error.message);
      return 0;
    }
  }

  /**
   * Calculate system-wide performance benchmarks
   * @param {Array} driverStats - Array of processed driver statistics
   * @returns {Object} Performance benchmarks
   */
  calculatePerformanceBenchmarks(driverStats) {
    try {
      if (!driverStats || driverStats.length === 0) {
        return {
          completionRate: { average: 0, median: 0, top25: 0 },
          resolutionTime: { average: 0, median: 0, best25: 0 },
          productivity: { average: 0, median: 0, top25: 0 },
          consistency: { average: 0, median: 0, top25: 0 }
        };
      }

      // Calculate benchmarks for each metric
      const completionRates = driverStats.map(d => d.completionRate).sort((a, b) => b - a);
      const resolutionTimes = driverStats.map(d => d.averageResolutionTime).filter(t => t > 0).sort((a, b) => a - b);
      const productivityScores = driverStats.map(d => d.productivityScore).sort((a, b) => b - a);
      const consistencyScores = driverStats.map(d => d.consistencyScore).sort((a, b) => b - a);

      return {
        completionRate: {
          average: this.calculateAverage(completionRates),
          median: this.calculateMedian(completionRates),
          top25: this.calculatePercentile(completionRates, 75)
        },
        resolutionTime: {
          average: this.calculateAverage(resolutionTimes),
          median: this.calculateMedian(resolutionTimes),
          best25: this.calculatePercentile(resolutionTimes, 25) // Lower is better for resolution time
        },
        productivity: {
          average: this.calculateAverage(productivityScores),
          median: this.calculateMedian(productivityScores),
          top25: this.calculatePercentile(productivityScores, 75)
        },
        consistency: {
          average: this.calculateAverage(consistencyScores),
          median: this.calculateMedian(consistencyScores),
          top25: this.calculatePercentile(consistencyScores, 75)
        }
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculatePerformanceBenchmarks:', error.message);
      return {
        completionRate: { average: 0, median: 0, top25: 0 },
        resolutionTime: { average: 0, median: 0, best25: 0 },
        productivity: { average: 0, median: 0, top25: 0 },
        consistency: { average: 0, median: 0, top25: 0 }
      };
    }
  }

  /**
   * Generate comprehensive status analytics with transition analysis
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

      // Calculate status transition analytics
      const transitionAnalytics = await this.calculateStatusTransitions(validReports);
      
      // Calculate workflow timing analytics
      const workflowTimings = await this.calculateWorkflowTimings(validReports);

      // Calculate average time in each status using status history
      const statusTimeAnalytics = await this.calculateStatusTimeAnalytics(validReports);

      return {
        totalReports,
        validReports: validReports.length,
        excludedReports: reports.length - validReports.length,
        statusDistribution,
        transitionAnalytics,
        workflowTimings,
        statusTimeAnalytics,
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
   * Calculate status transition patterns and frequencies
   * @param {Array} reports - Array of reports with status history
   * @returns {Object} Status transition analytics
   */
  async calculateStatusTransitions(reports) {
    try {
      const transitions = new Map();
      const transitionCounts = {};
      const transitionTimes = {};

      // Initialize transition tracking
      this.validStatuses.forEach(fromStatus => {
        this.validStatuses.forEach(toStatus => {
          if (fromStatus !== toStatus) {
            const key = `${fromStatus}->${toStatus}`;
            transitionCounts[key] = 0;
            transitionTimes[key] = [];
          }
        });
      });

      // Process each report's status history
      reports.forEach(report => {
        if (report.statusHistory && report.statusHistory.length > 1) {
          for (let i = 1; i < report.statusHistory.length; i++) {
            const fromStatus = report.statusHistory[i - 1].status;
            const toStatus = report.statusHistory[i].status;
            const transitionKey = `${fromStatus}->${toStatus}`;

            if (transitionCounts.hasOwnProperty(transitionKey)) {
              transitionCounts[transitionKey]++;
              
              // Calculate transition time
              const fromTime = new Date(report.statusHistory[i - 1].timestamp);
              const toTime = new Date(report.statusHistory[i].timestamp);
              const transitionTime = (toTime - fromTime) / (1000 * 60 * 60); // Hours
              
              if (transitionTime >= 0) {
                transitionTimes[transitionKey].push(transitionTime);
              }
            }
          }
        }
      });

      // Calculate transition statistics
      const transitionStats = Object.entries(transitionCounts).map(([transition, count]) => {
        const times = transitionTimes[transition];
        const averageTime = times.length > 0 
          ? Math.round((times.reduce((sum, time) => sum + time, 0) / times.length) * 100) / 100
          : 0;
        
        const [fromStatus, toStatus] = transition.split('->');
        
        return {
          fromStatus,
          toStatus,
          count,
          averageTime,
          medianTime: times.length > 0 ? this.calculateMedian(times) : 0,
          minTime: times.length > 0 ? Math.min(...times) : 0,
          maxTime: times.length > 0 ? Math.max(...times) : 0
        };
      }).filter(stat => stat.count > 0);

      // Calculate most common transition paths
      const commonPaths = this.identifyCommonTransitionPaths(reports);

      return {
        transitionStats,
        commonPaths,
        totalTransitions: Object.values(transitionCounts).reduce((sum, count) => sum + count, 0)
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateStatusTransitions:', error.message);
      return {
        transitionStats: [],
        commonPaths: [],
        totalTransitions: 0
      };
    }
  }

  /**
   * Identify common transition paths in reports
   * @param {Array} reports - Array of reports with status history
   * @returns {Array} Common transition paths
   */
  identifyCommonTransitionPaths(reports) {
    try {
      const pathCounts = new Map();
      
      reports.forEach(report => {
        if (report.statusHistory && report.statusHistory.length > 1) {
          // Create path from status history
          const path = report.statusHistory
            .map(entry => entry.status)
            .join(' â†’ ');
          
          pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
        }
      });

      // Convert to array and sort by frequency
      return Array.from(pathCounts.entries())
        .map(([path, count]) => ({
          path,
          count,
          percentage: reports.length > 0 ? Math.round((count / reports.length) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 most common paths

    } catch (error) {
      console.error('[ERROR] Analytics Engine - identifyCommonTransitionPaths:', error.message);
      return [];
    }
  }

  /**
   * Calculate comprehensive workflow timing analytics
   * @param {Array} reports - Array of reports with status history
   * @returns {Object} Workflow timing analytics
   */
  async calculateWorkflowTimings(reports) {
    try {
      const workflowMetrics = {
        averageResolutionTime: 0,
        medianResolutionTime: 0,
        resolutionTimeByCategory: {},
        timeToAssignment: 0,
        timeToCompletion: 0,
        timeToRejection: 0,
        workflowEfficiency: 0
      };

      const resolutionTimes = [];
      const assignmentTimes = [];
      const completionTimes = [];
      const rejectionTimes = [];
      const categoryResolutionTimes = {};

      // Initialize category tracking
      this.validCategories.forEach(category => {
        categoryResolutionTimes[category] = [];
      });

      reports.forEach(report => {
        if (report.statusHistory && report.statusHistory.length > 0) {
          const startTime = new Date(report.statusHistory[0].timestamp);
          const category = report.category;

          // Find specific status timestamps
          const assignedStatus = report.statusHistory.find(h => h.status === 'Assigned');
          const completedStatus = report.statusHistory.find(h => h.status === 'Completed');
          const rejectedStatus = report.statusHistory.find(h => h.status === 'Rejected');

          // Calculate time to assignment
          if (assignedStatus) {
            const assignmentTime = (new Date(assignedStatus.timestamp) - startTime) / (1000 * 60 * 60);
            if (assignmentTime >= 0) {
              assignmentTimes.push(assignmentTime);
            }
          }

          // Calculate resolution times
          if (completedStatus) {
            const resolutionTime = (new Date(completedStatus.timestamp) - startTime) / (1000 * 60 * 60);
            if (resolutionTime >= 0) {
              resolutionTimes.push(resolutionTime);
              completionTimes.push(resolutionTime);
              
              if (categoryResolutionTimes[category]) {
                categoryResolutionTimes[category].push(resolutionTime);
              }
            }
          }

          if (rejectedStatus) {
            const rejectionTime = (new Date(rejectedStatus.timestamp) - startTime) / (1000 * 60 * 60);
            if (rejectionTime >= 0) {
              resolutionTimes.push(rejectionTime);
              rejectionTimes.push(rejectionTime);
            }
          }
        }
      });

      // Calculate metrics
      workflowMetrics.averageResolutionTime = this.calculateAverage(resolutionTimes);
      workflowMetrics.medianResolutionTime = this.calculateMedian(resolutionTimes);
      workflowMetrics.timeToAssignment = this.calculateAverage(assignmentTimes);
      workflowMetrics.timeToCompletion = this.calculateAverage(completionTimes);
      workflowMetrics.timeToRejection = this.calculateAverage(rejectionTimes);

      // Calculate resolution times by category
      Object.entries(categoryResolutionTimes).forEach(([category, times]) => {
        workflowMetrics.resolutionTimeByCategory[category] = {
          average: this.calculateAverage(times),
          median: this.calculateMedian(times),
          count: times.length
        };
      });

      // Calculate workflow efficiency (percentage of reports resolved within target time)
      const targetResolutionTime = 48; // 48 hours target
      const efficientResolutions = resolutionTimes.filter(time => time <= targetResolutionTime).length;
      workflowMetrics.workflowEfficiency = resolutionTimes.length > 0
        ? Math.round((efficientResolutions / resolutionTimes.length) * 100)
        : 0;

      return workflowMetrics;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateWorkflowTimings:', error.message);
      return {
        averageResolutionTime: 0,
        medianResolutionTime: 0,
        resolutionTimeByCategory: {},
        timeToAssignment: 0,
        timeToCompletion: 0,
        timeToRejection: 0,
        workflowEfficiency: 0
      };
    }
  }

  /**
   * Calculate time spent in each status
   * @param {Array} reports - Array of reports with status history
   * @returns {Object} Status time analytics
   */
  async calculateStatusTimeAnalytics(reports) {
    try {
      const statusTimes = {};
      
      // Initialize status time tracking
      this.validStatuses.forEach(status => {
        statusTimes[status] = [];
      });

      reports.forEach(report => {
        if (report.statusHistory && report.statusHistory.length > 0) {
          for (let i = 0; i < report.statusHistory.length; i++) {
            const currentStatus = report.statusHistory[i];
            const nextStatus = report.statusHistory[i + 1];
            
            if (nextStatus) {
              // Calculate time spent in current status
              const timeInStatus = (new Date(nextStatus.timestamp) - new Date(currentStatus.timestamp)) / (1000 * 60 * 60);
              if (timeInStatus >= 0) {
                statusTimes[currentStatus.status].push(timeInStatus);
              }
            } else if (i === report.statusHistory.length - 1) {
              // For the final status, calculate time from status change to now (or updatedAt)
              const endTime = report.updatedAt ? new Date(report.updatedAt) : new Date();
              const timeInStatus = (endTime - new Date(currentStatus.timestamp)) / (1000 * 60 * 60);
              if (timeInStatus >= 0) {
                statusTimes[currentStatus.status].push(timeInStatus);
              }
            }
          }
        }
      });

      // Calculate statistics for each status
      const statusAnalytics = {};
      Object.entries(statusTimes).forEach(([status, times]) => {
        statusAnalytics[status] = {
          averageTime: this.calculateAverage(times),
          medianTime: this.calculateMedian(times),
          minTime: times.length > 0 ? Math.min(...times) : 0,
          maxTime: times.length > 0 ? Math.max(...times) : 0,
          totalReports: times.length,
          totalTime: times.reduce((sum, time) => sum + time, 0)
        };
      });

      return statusAnalytics;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateStatusTimeAnalytics:', error.message);
      return {};
    }
  }

  /**
   * Generate timeline visualization data for workflow analysis
   * @param {Array} reports - Array of reports with status history
   * @param {Object} options - Visualization options
   * @returns {Object} Timeline visualization data
   */
  async generateWorkflowTimeline(reports, options = {}) {
    try {
      const { groupBy = 'day', category = 'all', maxReports = 100 } = options;
      
      // Filter reports by category if specified
      let filteredReports = reports;
      if (category !== 'all') {
        filteredReports = reports.filter(r => r.category === category);
      }

      // Limit reports for performance
      if (filteredReports.length > maxReports) {
        filteredReports = filteredReports
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, maxReports);
      }

      const timelineData = [];
      const statusEvents = [];

      filteredReports.forEach(report => {
        if (report.statusHistory && report.statusHistory.length > 0) {
          const reportTimeline = {
            reportId: report._id,
            category: report.category,
            totalDuration: 0,
            events: []
          };

          // Process each status in the history
          for (let i = 0; i < report.statusHistory.length; i++) {
            const currentStatus = report.statusHistory[i];
            const nextStatus = report.statusHistory[i + 1];
            
            const startTime = new Date(currentStatus.timestamp);
            const endTime = nextStatus 
              ? new Date(nextStatus.timestamp)
              : (report.updatedAt ? new Date(report.updatedAt) : new Date());

            const duration = (endTime - startTime) / (1000 * 60 * 60); // Hours

            const event = {
              status: currentStatus.status,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              duration: Math.round(duration * 100) / 100,
              isActive: !nextStatus // Last status is currently active
            };

            reportTimeline.events.push(event);
            reportTimeline.totalDuration += duration;

            // Add to global status events for aggregation
            statusEvents.push({
              ...event,
              reportId: report._id,
              category: report.category
            });
          }

          timelineData.push(reportTimeline);
        }
      });

      // Generate aggregated timeline by time period
      const aggregatedTimeline = this.aggregateTimelineByPeriod(statusEvents, groupBy);

      // Calculate workflow bottlenecks
      const bottlenecks = this.identifyWorkflowBottlenecks(statusEvents);

      // Generate workflow efficiency metrics
      const efficiencyMetrics = this.calculateWorkflowEfficiencyMetrics(timelineData);

      return {
        reportTimelines: timelineData,
        aggregatedTimeline,
        bottlenecks,
        efficiencyMetrics,
        totalReports: filteredReports.length,
        timeRange: {
          start: new Date(Math.min(...filteredReports.map(r => new Date(r.createdAt)))).toISOString(),
          end: new Date(Math.max(...filteredReports.map(r => new Date(r.updatedAt || r.createdAt)))).toISOString()
        }
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generateWorkflowTimeline:', error.message);
      throw new Error(`Workflow timeline generation failed: ${error.message}`);
    }
  }

  /**
   * Aggregate timeline events by time period
   * @param {Array} statusEvents - Array of status events
   * @param {String} groupBy - Time period ('hour', 'day', 'week')
   * @returns {Array} Aggregated timeline data
   */
  aggregateTimelineByPeriod(statusEvents, groupBy) {
    try {
      const aggregationMap = new Map();
      
      statusEvents.forEach(event => {
        const eventDate = new Date(event.startTime);
        let periodKey;

        switch (groupBy) {
          case 'hour':
            periodKey = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}-${eventDate.getDate()}-${eventDate.getHours()}`;
            break;
          case 'week':
            const weekStart = new Date(eventDate);
            weekStart.setDate(eventDate.getDate() - eventDate.getDay());
            periodKey = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
            break;
          case 'day':
          default:
            periodKey = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}-${eventDate.getDate()}`;
            break;
        }

        if (!aggregationMap.has(periodKey)) {
          aggregationMap.set(periodKey, {
            period: periodKey,
            statusCounts: {},
            totalEvents: 0,
            averageDuration: 0,
            categories: {}
          });
        }

        const periodData = aggregationMap.get(periodKey);
        periodData.totalEvents++;
        
        // Count status occurrences
        periodData.statusCounts[event.status] = (periodData.statusCounts[event.status] || 0) + 1;
        
        // Track category distribution
        periodData.categories[event.category] = (periodData.categories[event.category] || 0) + 1;
        
        // Update average duration
        const currentAvg = periodData.averageDuration;
        const newCount = periodData.totalEvents;
        periodData.averageDuration = ((currentAvg * (newCount - 1)) + event.duration) / newCount;
      });

      return Array.from(aggregationMap.values())
        .sort((a, b) => a.period.localeCompare(b.period));

    } catch (error) {
      console.error('[ERROR] Analytics Engine - aggregateTimelineByPeriod:', error.message);
      return [];
    }
  }

  /**
   * Identify workflow bottlenecks based on status duration analysis
   * @param {Array} statusEvents - Array of status events
   * @returns {Array} Identified bottlenecks
   */
  identifyWorkflowBottlenecks(statusEvents) {
    try {
      const statusDurations = {};
      
      // Group durations by status
      statusEvents.forEach(event => {
        if (!statusDurations[event.status]) {
          statusDurations[event.status] = [];
        }
        statusDurations[event.status].push(event.duration);
      });

      const bottlenecks = [];

      // Analyze each status for bottleneck indicators
      Object.entries(statusDurations).forEach(([status, durations]) => {
        if (durations.length === 0) return;

        const average = this.calculateAverage(durations);
        const median = this.calculateMedian(durations);
        const percentile90 = this.calculatePercentile(durations, 90);
        const percentile95 = this.calculatePercentile(durations, 95);

        // Identify bottleneck conditions
        const isBottleneck = 
          average > 24 || // Average time > 24 hours
          percentile90 > 72 || // 90% of cases > 72 hours
          (median > 0 && average / median > 2); // High variance (average >> median)

        if (isBottleneck) {
          bottlenecks.push({
            status,
            severity: this.calculateBottleneckSeverity(average, percentile90, percentile95),
            metrics: {
              averageDuration: Math.round(average * 100) / 100,
              medianDuration: Math.round(median * 100) / 100,
              percentile90: Math.round(percentile90 * 100) / 100,
              percentile95: Math.round(percentile95 * 100) / 100,
              totalCases: durations.length
            },
            recommendations: this.generateBottleneckRecommendations(status, average, percentile90)
          });
        }
      });

      return bottlenecks.sort((a, b) => b.severity - a.severity);

    } catch (error) {
      console.error('[ERROR] Analytics Engine - identifyWorkflowBottlenecks:', error.message);
      return [];
    }
  }

  /**
   * Calculate bottleneck severity score
   * @param {Number} average - Average duration
   * @param {Number} percentile90 - 90th percentile duration
   * @param {Number} percentile95 - 95th percentile duration
   * @returns {Number} Severity score (0-100)
   */
  calculateBottleneckSeverity(average, percentile90, percentile95) {
    try {
      let severity = 0;

      // Base severity on average duration
      if (average > 168) severity += 40; // > 1 week
      else if (average > 72) severity += 30; // > 3 days
      else if (average > 24) severity += 20; // > 1 day
      else if (average > 12) severity += 10; // > 12 hours

      // Add severity based on 90th percentile
      if (percentile90 > 336) severity += 30; // > 2 weeks
      else if (percentile90 > 168) severity += 20; // > 1 week
      else if (percentile90 > 72) severity += 15; // > 3 days

      // Add severity based on variance (95th vs 90th percentile)
      const variance = percentile95 - percentile90;
      if (variance > 168) severity += 20; // High variance
      else if (variance > 72) severity += 10;

      return Math.min(100, severity);

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateBottleneckSeverity:', error.message);
      return 0;
    }
  }

  /**
   * Generate recommendations for addressing bottlenecks
   * @param {String} status - Status with bottleneck
   * @param {Number} average - Average duration
   * @param {Number} percentile90 - 90th percentile duration
   * @returns {Array} Recommendations
   */
  generateBottleneckRecommendations(status, average, percentile90) {
    const recommendations = [];

    try {
      switch (status) {
        case 'Pending':
          recommendations.push('Consider automated assignment rules to reduce pending time');
          if (average > 24) {
            recommendations.push('Implement priority queuing for urgent incidents');
          }
          break;

        case 'Assigned':
          recommendations.push('Review driver workload distribution');
          if (percentile90 > 72) {
            recommendations.push('Consider additional driver resources or reassignment policies');
          }
          break;

        case 'In Progress':
          recommendations.push('Analyze field completion challenges');
          if (average > 48) {
            recommendations.push('Provide additional tools or training for complex incidents');
          }
          break;

        default:
          recommendations.push(`Review ${status.toLowerCase()} process for optimization opportunities`);
          break;
      }

      // General recommendations based on severity
      if (average > 168) {
        recommendations.push('Critical: Implement escalation procedures for long-running cases');
      }

      return recommendations;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generateBottleneckRecommendations:', error.message);
      return ['Review process for optimization opportunities'];
    }
  }

  /**
   * Calculate workflow efficiency metrics from timeline data
   * @param {Array} timelineData - Array of report timelines
   * @returns {Object} Efficiency metrics
   */
  calculateWorkflowEfficiencyMetrics(timelineData) {
    try {
      if (!timelineData || timelineData.length === 0) {
        return {
          averageWorkflowDuration: 0,
          medianWorkflowDuration: 0,
          efficiencyScore: 0,
          completionRate: 0,
          categoryEfficiency: {}
        };
      }

      const durations = timelineData.map(timeline => timeline.totalDuration);
      const completedTimelines = timelineData.filter(timeline => 
        timeline.events.some(event => event.status === 'Completed')
      );

      // Calculate category-specific efficiency
      const categoryEfficiency = {};
      this.validCategories.forEach(category => {
        const categoryTimelines = timelineData.filter(t => t.category === category);
        if (categoryTimelines.length > 0) {
          const categoryDurations = categoryTimelines.map(t => t.totalDuration);
          categoryEfficiency[category] = {
            averageDuration: this.calculateAverage(categoryDurations),
            medianDuration: this.calculateMedian(categoryDurations),
            count: categoryTimelines.length,
            completionRate: Math.round((categoryTimelines.filter(t => 
              t.events.some(e => e.status === 'Completed')
            ).length / categoryTimelines.length) * 100)
          };
        }
      });

      // Calculate overall efficiency score (0-100)
      const targetDuration = 48; // 48 hours target
      const efficientWorkflows = durations.filter(d => d <= targetDuration).length;
      const efficiencyScore = Math.round((efficientWorkflows / durations.length) * 100);

      return {
        averageWorkflowDuration: this.calculateAverage(durations),
        medianWorkflowDuration: this.calculateMedian(durations),
        efficiencyScore,
        completionRate: Math.round((completedTimelines.length / timelineData.length) * 100),
        categoryEfficiency,
        totalWorkflows: timelineData.length,
        efficientWorkflows
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateWorkflowEfficiencyMetrics:', error.message);
      return {
        averageWorkflowDuration: 0,
        medianWorkflowDuration: 0,
        efficiencyScore: 0,
        completionRate: 0,
        categoryEfficiency: {}
      };
    }
  }

  /**
   * Validate report data for analytics processing with comprehensive checks
   * @param {Object} report - Report object to validate
   * @returns {Object} Validation result with details
   */
  validateReportData(report) {
    const validationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    try {
      // Null/undefined check
      if (!report) {
        validationResult.errors.push('Report object is null or undefined');
        return validationResult;
      }

      // Required field validation with specific error messages
      if (!report._id) {
        validationResult.errors.push('Missing required field: _id');
      }

      if (!report.createdAt) {
        validationResult.errors.push('Missing required field: createdAt');
      }

      if (!report.category) {
        validationResult.errors.push('Missing required field: category');
      }

      if (!report.status) {
        validationResult.errors.push('Missing required field: status');
      }

      // Category validation with case-insensitive check
      if (report.category) {
        const normalizedCategory = typeof report.category === 'string' ? report.category.toLowerCase() : '';
        const validCategoriesLower = this.validCategories.map(c => c.toLowerCase());
        
        if (!validCategoriesLower.includes(normalizedCategory)) {
          validationResult.errors.push(`Invalid category: ${report.category}. Valid categories: ${this.validCategories.join(', ')}`);
        }
      }

      // Status validation with case-sensitive check
      if (report.status && !this.validStatuses.includes(report.status)) {
        validationResult.errors.push(`Invalid status: ${report.status}. Valid statuses: ${this.validStatuses.join(', ')}`);
      }

      // Date validation with detailed error reporting
      if (report.createdAt) {
        const createdAt = new Date(report.createdAt);
        if (isNaN(createdAt.getTime())) {
          validationResult.errors.push(`Invalid createdAt date format: ${report.createdAt}`);
        } else {
          // Check for reasonable date range (not in future, not too old)
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          
          if (createdAt > now) {
            validationResult.warnings.push('createdAt is in the future');
          }
          
          if (createdAt < oneYearAgo) {
            validationResult.warnings.push('createdAt is more than one year old');
          }
        }
      }

      // Optional field validation
      if (report.updatedAt) {
        const updatedAt = new Date(report.updatedAt);
        if (isNaN(updatedAt.getTime())) {
          validationResult.warnings.push(`Invalid updatedAt date format: ${report.updatedAt}`);
        } else if (report.createdAt) {
          const createdAt = new Date(report.createdAt);
          if (!isNaN(createdAt.getTime()) && updatedAt < createdAt) {
            validationResult.errors.push('updatedAt cannot be before createdAt');
          }
        }
      }

      // Coordinate validation if present
      if (report.latitude !== undefined || report.longitude !== undefined) {
        if (report.latitude === null || report.longitude === null) {
          validationResult.warnings.push('Coordinates are null - geographic analysis will exclude this record');
        } else if (!this.validateCoordinates(report.latitude, report.longitude)) {
          validationResult.warnings.push(`Invalid coordinates: lat=${report.latitude}, lng=${report.longitude}`);
        }
      }

      // Status history validation
      if (report.statusHistory) {
        if (!Array.isArray(report.statusHistory)) {
          validationResult.warnings.push('statusHistory should be an array');
        } else if (report.statusHistory.length === 0) {
          validationResult.warnings.push('statusHistory is empty');
        } else {
          // Validate status history entries
          report.statusHistory.forEach((entry, index) => {
            if (!entry.status || !entry.timestamp) {
              validationResult.warnings.push(`statusHistory[${index}] missing required fields`);
            } else if (!this.validStatuses.includes(entry.status)) {
              validationResult.warnings.push(`statusHistory[${index}] has invalid status: ${entry.status}`);
            }
          });
        }
      }

      // Assigned driver validation
      if (report.assignedDriver !== undefined && report.assignedDriver !== null) {
        if (typeof report.assignedDriver !== 'string' && typeof report.assignedDriver !== 'object') {
          validationResult.warnings.push('assignedDriver should be a string or ObjectId');
        }
      }

      // Description validation
      if (report.description !== undefined) {
        if (typeof report.description !== 'string') {
          validationResult.warnings.push('description should be a string');
        } else if (report.description.length > 10000) {
          validationResult.warnings.push('description is unusually long (>10000 characters)');
        }
      }

      // Set validation result
      validationResult.isValid = validationResult.errors.length === 0;

      return validationResult;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - validateReportData:', error.message);
      validationResult.errors.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  /**
   * Calculate data quality metrics for a dataset with comprehensive analysis
   * @param {Array} reports - Array of reports to analyze
   * @returns {Object} Enhanced data quality metrics
   */
  async calculateDataQuality(reports) {
    try {
      if (!reports || !Array.isArray(reports)) {
        console.warn('[WARN] Analytics Engine - calculateDataQuality: Invalid input - not an array');
        return {
          totalRecords: 0,
          validRecords: 0,
          excludedRecords: 0,
          qualityScore: 100,
          exclusionReasons: {},
          validationDetails: {
            errors: ['Input is not a valid array'],
            warnings: []
          }
        };
      }

      const totalRecords = reports.length;
      let validRecords = 0;
      const exclusionReasons = {
        invalidDates: 0,
        invalidCoordinates: 0,
        missingData: 0,
        duplicates: 0,
        invalidCategory: 0,
        invalidStatus: 0,
        validationErrors: 0
      };

      const validationDetails = {
        errors: [],
        warnings: [],
        processedRecords: 0
      };

      const seenIds = new Set();

      for (let i = 0; i < reports.length; i++) {
        const report = reports[i];
        validationDetails.processedRecords++;
        
        try {
          // Comprehensive validation
          const validation = this.validateReportData(report);
          
          // Track validation errors and warnings
          if (validation.errors.length > 0) {
            validationDetails.errors.push(`Record ${i}: ${validation.errors.join(', ')}`);
            exclusionReasons.validationErrors++;
            continue; // Skip this record
          }

          if (validation.warnings.length > 0) {
            validationDetails.warnings.push(`Record ${i}: ${validation.warnings.join(', ')}`);
          }

          // Check for duplicates
          if (report._id) {
            const idString = report._id.toString();
            if (seenIds.has(idString)) {
              exclusionReasons.duplicates++;
              validationDetails.errors.push(`Record ${i}: Duplicate ID ${idString}`);
              continue;
            }
            seenIds.add(idString);
          }

          // Additional specific checks for exclusion reasons
          if (report.createdAt) {
            const createdAt = new Date(report.createdAt);
            if (isNaN(createdAt.getTime())) {
              exclusionReasons.invalidDates++;
              continue;
            }
          }

          // Validate coordinates (if present) for geographic analysis
          if ((report.latitude !== undefined || report.longitude !== undefined) && 
              !this.validateCoordinates(report.latitude, report.longitude)) {
            exclusionReasons.invalidCoordinates++;
            // Don't exclude the record, just note the coordinate issue
          }

          // Check for missing critical data
          if (!report._id || !report.createdAt || !report.category || !report.status) {
            exclusionReasons.missingData++;
            continue;
          }

          // Validate category
          if (report.category && !this.validCategories.includes(report.category)) {
            exclusionReasons.invalidCategory++;
            continue;
          }

          // Validate status
          if (report.status && !this.validStatuses.includes(report.status)) {
            exclusionReasons.invalidStatus++;
            continue;
          }

          // If we reach here, the record is valid
          validRecords++;

        } catch (recordError) {
          console.error(`[ERROR] Analytics Engine - Processing record ${i}:`, recordError.message);
          exclusionReasons.validationErrors++;
          validationDetails.errors.push(`Record ${i}: Processing error - ${recordError.message}`);
        }
      }

      const excludedRecords = totalRecords - validRecords;
      const qualityScore = totalRecords > 0 ? Math.round((validRecords / totalRecords) * 100) : 100;

      // Log quality issues if significant
      if (qualityScore < 90) {
        console.warn(`[WARN] Analytics Engine - Data quality below 90%: ${qualityScore}% (${excludedRecords}/${totalRecords} excluded)`);
      }

      if (excludedRecords > 0) {
        console.log(`[INFO] Analytics Engine - Data quality summary: ${validRecords}/${totalRecords} valid records (${qualityScore}%)`);
      }

      return {
        totalRecords,
        validRecords,
        excludedRecords,
        qualityScore,
        exclusionReasons,
        validationDetails: {
          ...validationDetails,
          errorCount: validationDetails.errors.length,
          warningCount: validationDetails.warnings.length
        },
        recommendations: this.generateDataQualityRecommendations(exclusionReasons, qualityScore)
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateDataQuality:', error.message);
      return {
        totalRecords: 0,
        validRecords: 0,
        excludedRecords: 0,
        qualityScore: 0,
        exclusionReasons: {
          processingError: 1
        },
        validationDetails: {
          errors: [`Critical processing error: ${error.message}`],
          warnings: [],
          errorCount: 1,
          warningCount: 0
        },
        recommendations: ['Fix critical processing errors before proceeding with analysis']
      };
    }
  }

  /**
   * Generate data quality improvement recommendations
   * @param {Object} exclusionReasons - Reasons for data exclusion
   * @param {Number} qualityScore - Overall quality score
   * @returns {Array} Array of recommendations
   */
  generateDataQualityRecommendations(exclusionReasons, qualityScore) {
    const recommendations = [];

    try {
      if (qualityScore < 50) {
        recommendations.push('CRITICAL: Data quality is below 50%. Review data collection and validation processes.');
      } else if (qualityScore < 80) {
        recommendations.push('WARNING: Data quality is below 80%. Consider improving data validation.');
      }

      if (exclusionReasons.missingData > 0) {
        recommendations.push(`${exclusionReasons.missingData} records missing required fields. Ensure all required fields are populated.`);
      }

      if (exclusionReasons.invalidDates > 0) {
        recommendations.push(`${exclusionReasons.invalidDates} records have invalid dates. Verify date format consistency.`);
      }

      if (exclusionReasons.invalidCoordinates > 0) {
        recommendations.push(`${exclusionReasons.invalidCoordinates} records have invalid coordinates. Check geocoding service.`);
      }

      if (exclusionReasons.duplicates > 0) {
        recommendations.push(`${exclusionReasons.duplicates} duplicate records found. Implement deduplication process.`);
      }

      if (exclusionReasons.invalidCategory > 0) {
        recommendations.push(`${exclusionReasons.invalidCategory} records have invalid categories. Standardize category values.`);
      }

      if (exclusionReasons.invalidStatus > 0) {
        recommendations.push(`${exclusionReasons.invalidStatus} records have invalid status values. Ensure status consistency.`);
      }

      if (recommendations.length === 0) {
        recommendations.push('Data quality is good. No immediate improvements needed.');
      }

      return recommendations;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generateDataQualityRecommendations:', error.message);
      return ['Error generating recommendations. Review data quality manually.'];
    }
  }

  /**
   * Exclude invalid records from dataset with detailed logging
   * @param {Array} reports - Array of reports to filter
   * @returns {Object} { validReports, excludedCount, dataQualityScore, exclusionDetails }
   */
  excludeInvalidRecords(reports) {
    try {
      if (!reports || !Array.isArray(reports)) {
        console.error('[ERROR] Analytics Engine - excludeInvalidRecords: Input is not a valid array');
        return {
          validReports: [],
          excludedCount: 0,
          dataQualityScore: 0,
          exclusionDetails: {
            reason: 'Invalid input - not an array',
            originalCount: 0
          }
        };
      }

      const originalCount = reports.length;
      const validReports = [];
      const excludedReports = [];

      for (let i = 0; i < reports.length; i++) {
        const report = reports[i];
        
        try {
          const validation = this.validateReportData(report);
          
          if (validation.isValid) {
            validReports.push(report);
          } else {
            excludedReports.push({
              index: i,
              report: report,
              errors: validation.errors,
              warnings: validation.warnings
            });
          }
        } catch (validationError) {
          console.error(`[ERROR] Analytics Engine - Validating record ${i}:`, validationError.message);
          excludedReports.push({
            index: i,
            report: report,
            errors: [`Validation failed: ${validationError.message}`],
            warnings: []
          });
        }
      }

      const excludedCount = excludedReports.length;
      const dataQualityScore = originalCount > 0 
        ? Math.round((validReports.length / originalCount) * 100)
        : 100;

      // Log exclusion details if significant
      if (excludedCount > 0) {
        const exclusionRate = Math.round((excludedCount / originalCount) * 100);
        
        if (exclusionRate > 10) {
          console.warn(`[WARN] Analytics Engine - High exclusion rate: ${exclusionRate}% (${excludedCount}/${originalCount} records excluded)`);
          
          // Log sample of exclusion reasons
          const sampleExclusions = excludedReports.slice(0, 5);
          sampleExclusions.forEach(excluded => {
            console.warn(`[WARN] Sample exclusion - Record ${excluded.index}: ${excluded.errors.join(', ')}`);
          });
        } else {
          console.log(`[INFO] Analytics Engine - Excluded ${excludedCount} invalid records from ${originalCount} total records (${exclusionRate}%)`);
        }
      }

      return {
        validReports,
        excludedCount,
        dataQualityScore,
        exclusionDetails: {
          originalCount,
          validCount: validReports.length,
          excludedCount,
          exclusionRate: originalCount > 0 ? Math.round((excludedCount / originalCount) * 100) : 0,
          sampleExclusions: excludedReports.slice(0, 10).map(e => ({
            index: e.index,
            errors: e.errors,
            warnings: e.warnings
          }))
        }
      };
    } catch (error) {
      console.error('[ERROR] Analytics Engine - excludeInvalidRecords:', error.message);
      return {
        validReports: [],
        excludedCount: reports ? reports.length : 0,
        dataQualityScore: 0,
        exclusionDetails: {
          reason: `Processing error: ${error.message}`,
          originalCount: reports ? reports.length : 0
        }
      };
    }
  }

  /**
   * Calculate average of an array of numbers with null handling
   * @param {Array} values - Array of numeric values
   * @returns {Number} Average value
   */
  calculateAverage(values) {
    try {
      if (!values || !Array.isArray(values) || values.length === 0) {
        return 0;
      }

      // Filter out null, undefined, NaN, and non-numeric values
      const validValues = values.filter(val => 
        val !== null && 
        val !== undefined && 
        typeof val === 'number' && 
        !isNaN(val) && 
        isFinite(val)
      );

      if (validValues.length === 0) {
        return 0;
      }

      const sum = validValues.reduce((acc, val) => acc + val, 0);
      const average = sum / validValues.length;

      // Validate result
      if (!isFinite(average) || isNaN(average)) {
        console.warn('[WARN] Analytics Engine - calculateAverage: Result is not finite');
        return 0;
      }

      return Math.round(average * 100) / 100;
    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateAverage:', error.message);
      return 0;
    }
  }

  /**
   * Calculate median of an array of numbers with null handling
   * @param {Array} values - Array of numeric values
   * @returns {Number} Median value
   */
  calculateMedian(values) {
    try {
      if (!values || !Array.isArray(values) || values.length === 0) {
        return 0;
      }

      // Filter out null, undefined, NaN, and non-numeric values
      const validValues = values.filter(val => 
        val !== null && 
        val !== undefined && 
        typeof val === 'number' && 
        !isNaN(val) && 
        isFinite(val)
      );

      if (validValues.length === 0) {
        return 0;
      }

      const sorted = validValues.sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      
      let median;
      if (sorted.length % 2 === 0) {
        median = (sorted[middle - 1] + sorted[middle]) / 2;
      } else {
        median = sorted[middle];
      }

      // Validate result
      if (!isFinite(median) || isNaN(median)) {
        console.warn('[WARN] Analytics Engine - calculateMedian: Result is not finite');
        return 0;
      }

      return Math.round(median * 100) / 100;
    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateMedian:', error.message);
      return 0;
    }
  }

  /**
   * Calculate percentile of an array of numbers with null handling
   * @param {Array} values - Array of numeric values
   * @param {Number} percentile - Percentile to calculate (0-100)
   * @returns {Number} Percentile value
   */
  calculatePercentile(values, percentile) {
    try {
      if (!values || !Array.isArray(values) || values.length === 0) {
        return 0;
      }

      // Validate percentile parameter
      if (typeof percentile !== 'number' || isNaN(percentile) || percentile < 0 || percentile > 100) {
        console.warn(`[WARN] Analytics Engine - calculatePercentile: Invalid percentile value: ${percentile}`);
        return 0;
      }

      // Filter out null, undefined, NaN, and non-numeric values
      const validValues = values.filter(val => 
        val !== null && 
        val !== undefined && 
        typeof val === 'number' && 
        !isNaN(val) && 
        isFinite(val)
      );

      if (validValues.length === 0) {
        return 0;
      }

      const sorted = validValues.sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      const safeIndex = Math.max(0, Math.min(index, sorted.length - 1));
      
      const result = sorted[safeIndex];

      // Validate result
      if (!isFinite(result) || isNaN(result)) {
        console.warn('[WARN] Analytics Engine - calculatePercentile: Result is not finite');
        return 0;
      }

      return result;
    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculatePercentile:', error.message);
      return 0;
    }
  }

  /**
   * Get driver performance ranking and comparison
   * @param {String} driverId - Driver ID to rank
   * @param {Object} dateRange - Date range for analysis
   * @returns {Promise<Object>} Driver ranking and peer comparison
   */
  async getDriverPerformanceRanking(driverId, dateRange) {
    try {
      // Get all driver metrics for comparison
      const allDriverMetrics = await this.calculateDriverMetrics(null, dateRange);
      const targetDriver = allDriverMetrics.metrics.find(d => d.driverId.toString() === driverId.toString());
      
      if (!targetDriver) {
        throw new Error('Driver not found in performance data');
      }

      // Calculate rankings for different metrics
      const rankings = this.calculateDriverRankings(targetDriver, allDriverMetrics.metrics);
      
      // Generate peer comparison
      const peerComparison = this.generatePeerComparison(targetDriver, allDriverMetrics.benchmarks);

      return {
        driverId,
        totalDrivers: allDriverMetrics.driverCount,
        rankings,
        peerComparison,
        performanceMetrics: targetDriver,
        benchmarks: allDriverMetrics.benchmarks
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - getDriverPerformanceRanking:', error.message);
      throw new Error(`Driver ranking calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate driver rankings across different performance metrics
   * @param {Object} targetDriver - Driver to rank
   * @param {Array} allDrivers - All driver metrics for comparison
   * @returns {Object} Rankings across different metrics
   */
  calculateDriverRankings(targetDriver, allDrivers) {
    try {
      const rankings = {};
      
      // Completion rate ranking (higher is better)
      const completionRates = allDrivers.map(d => d.completionRate).sort((a, b) => b - a);
      rankings.completionRate = {
        rank: completionRates.indexOf(targetDriver.completionRate) + 1,
        percentile: Math.round((1 - (completionRates.indexOf(targetDriver.completionRate) / completionRates.length)) * 100)
      };

      // Resolution time ranking (lower is better)
      const resolutionTimes = allDrivers
        .filter(d => d.averageResolutionTime > 0)
        .map(d => d.averageResolutionTime)
        .sort((a, b) => a - b);
      const resolutionTimeRank = resolutionTimes.indexOf(targetDriver.averageResolutionTime) + 1;
      rankings.resolutionTime = {
        rank: resolutionTimeRank,
        percentile: Math.round((1 - (resolutionTimeRank - 1) / resolutionTimes.length) * 100)
      };

      // Productivity score ranking (higher is better)
      const productivityScores = allDrivers.map(d => d.productivityScore).sort((a, b) => b - a);
      rankings.productivity = {
        rank: productivityScores.indexOf(targetDriver.productivityScore) + 1,
        percentile: Math.round((1 - (productivityScores.indexOf(targetDriver.productivityScore) / productivityScores.length)) * 100)
      };

      // Consistency score ranking (higher is better)
      const consistencyScores = allDrivers.map(d => d.consistencyScore).sort((a, b) => b - a);
      rankings.consistency = {
        rank: consistencyScores.indexOf(targetDriver.consistencyScore) + 1,
        percentile: Math.round((1 - (consistencyScores.indexOf(targetDriver.consistencyScore) / consistencyScores.length)) * 100)
      };

      return rankings;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateDriverRankings:', error.message);
      return {
        completionRate: { rank: 0, percentile: 0 },
        resolutionTime: { rank: 0, percentile: 0 },
        productivity: { rank: 0, percentile: 0 },
        consistency: { rank: 0, percentile: 0 }
      };
    }
  }

  /**
   * Generate peer comparison analysis
   * @param {Object} targetDriver - Driver to compare
   * @param {Object} benchmarks - System benchmarks
   * @returns {Object} Peer comparison analysis
   */
  generatePeerComparison(targetDriver, benchmarks) {
    try {
      const comparison = {};

      // Compare against system averages
      comparison.vsSystemAverage = {
        completionRate: this.calculatePerformanceGap(targetDriver.completionRate, benchmarks.completionRate.average),
        resolutionTime: this.calculatePerformanceGap(benchmarks.resolutionTime.average, targetDriver.averageResolutionTime), // Inverted for resolution time
        productivity: this.calculatePerformanceGap(targetDriver.productivityScore, benchmarks.productivity.average),
        consistency: this.calculatePerformanceGap(targetDriver.consistencyScore, benchmarks.consistency.average)
      };

      // Compare against top 25% performers
      comparison.vsTop25 = {
        completionRate: this.calculatePerformanceGap(targetDriver.completionRate, benchmarks.completionRate.top25),
        resolutionTime: this.calculatePerformanceGap(benchmarks.resolutionTime.best25, targetDriver.averageResolutionTime),
        productivity: this.calculatePerformanceGap(targetDriver.productivityScore, benchmarks.productivity.top25),
        consistency: this.calculatePerformanceGap(targetDriver.consistencyScore, benchmarks.consistency.top25)
      };

      // Generate performance insights
      comparison.insights = this.generatePerformanceInsights(targetDriver, benchmarks);

      return comparison;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generatePeerComparison:', error.message);
      return {
        vsSystemAverage: {},
        vsTop25: {},
        insights: []
      };
    }
  }

  /**
   * Calculate performance gap between actual and benchmark values
   * @param {Number} actual - Actual performance value
   * @param {Number} benchmark - Benchmark value
   * @returns {Object} Performance gap analysis
   */
  calculatePerformanceGap(actual, benchmark) {
    if (!actual || !benchmark) {
      return { gap: 0, percentage: 0, status: 'unknown' };
    }

    const gap = actual - benchmark;
    const percentage = benchmark !== 0 ? Math.round((gap / benchmark) * 100) : 0;
    
    let status = 'equal';
    if (gap > 0) status = 'above';
    if (gap < 0) status = 'below';

    return {
      gap: Math.round(gap * 100) / 100,
      percentage,
      status
    };
  }

  /**
   * Generate performance insights and recommendations
   * @param {Object} driver - Driver performance data
   * @param {Object} benchmarks - System benchmarks
   * @returns {Array} Array of performance insights
   */
  generatePerformanceInsights(driver, benchmarks) {
    const insights = [];

    try {
      // Completion rate insights
      if (driver.completionRate < benchmarks.completionRate.average) {
        insights.push({
          type: 'improvement',
          metric: 'completion_rate',
          message: `Completion rate is ${Math.round(benchmarks.completionRate.average - driver.completionRate)}% below system average`,
          priority: 'high'
        });
      } else if (driver.completionRate >= benchmarks.completionRate.top25) {
        insights.push({
          type: 'strength',
          metric: 'completion_rate',
          message: 'Completion rate is in the top 25% of all drivers',
          priority: 'positive'
        });
      }

      // Resolution time insights
      if (driver.averageResolutionTime > benchmarks.resolutionTime.average && driver.averageResolutionTime > 0) {
        insights.push({
          type: 'improvement',
          metric: 'resolution_time',
          message: `Resolution time is ${Math.round(driver.averageResolutionTime - benchmarks.resolutionTime.average)} hours above average`,
          priority: 'medium'
        });
      } else if (driver.averageResolutionTime <= benchmarks.resolutionTime.best25 && driver.averageResolutionTime > 0) {
        insights.push({
          type: 'strength',
          metric: 'resolution_time',
          message: 'Resolution time is in the fastest 25% of all drivers',
          priority: 'positive'
        });
      }

      // Productivity insights
      if (driver.productivityScore < benchmarks.productivity.average) {
        insights.push({
          type: 'improvement',
          metric: 'productivity',
          message: `Productivity score is ${Math.round(benchmarks.productivity.average - driver.productivityScore)} points below average`,
          priority: 'medium'
        });
      }

      // Consistency insights
      if (driver.consistencyScore < benchmarks.consistency.average) {
        insights.push({
          type: 'improvement',
          metric: 'consistency',
          message: 'Performance consistency could be improved for more predictable results',
          priority: 'low'
        });
      }

      // Workload balance insights
      if (driver.workloadBalance < 70) {
        insights.push({
          type: 'observation',
          metric: 'workload_balance',
          message: 'Workload is concentrated in specific incident categories',
          priority: 'info'
        });
      }

      return insights;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - generatePerformanceInsights:', error.message);
      return [];
    }
  }

  /**
   * Get detailed driver assignment tracking and accuracy metrics
   * @param {String} driverId - Driver ID (optional)
   * @param {Object} dateRange - Date range for analysis
   * @returns {Promise<Object>} Assignment tracking metrics
   */
  async getDriverAssignmentTracking(driverId = null, dateRange) {
    try {
      const { startDate, endDate } = this.validateDateRange(dateRange);
      
      const matchCriteria = {
        assignedDriver: { $exists: true, $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (driverId) {
        matchCriteria.assignedDriver = driverId;
      }

      // Get detailed assignment data
      const assignmentData = await Report.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: "$assignedDriver",
            totalAssignments: { $sum: 1 },
            // Track assignment outcomes
            completedAssignments: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
            },
            rejectedAssignments: {
              $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] }
            },
            inProgressAssignments: {
              $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] }
            },
            pendingAssignments: {
              $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] }
            },
            // Track assignment timing
            assignmentTimes: { $push: "$assignedAt" },
            creationTimes: { $push: "$createdAt" },
            // Track category accuracy
            categoryAccuracy: {
              $push: {
                category: "$category",
                status: "$status",
                assignedAt: "$assignedAt"
              }
            }
          }
        }
      ]);

      // Process assignment tracking data
      const processedTracking = assignmentData.map(data => {
        return this.processAssignmentTrackingData(data, { startDate, endDate });
      });

      // Calculate system-wide assignment metrics
      const systemMetrics = this.calculateSystemAssignmentMetrics(processedTracking);

      return {
        driverCount: processedTracking.length,
        assignmentTracking: processedTracking,
        systemMetrics,
        period: { startDate, endDate }
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - getDriverAssignmentTracking:', error.message);
      throw new Error(`Assignment tracking calculation failed: ${error.message}`);
    }
  }

  /**
   * Process individual driver assignment tracking data
   * @param {Object} data - Raw assignment data from aggregation
   * @param {Object} period - Analysis period
   * @returns {Object} Processed assignment tracking metrics
   */
  processAssignmentTrackingData(data, period) {
    try {
      const totalAssignments = data.totalAssignments || 0;
      
      // Calculate assignment accuracy (non-rejected assignments)
      const activeAssignments = data.completedAssignments + data.inProgressAssignments;
      const assignmentAccuracy = totalAssignments > 0 
        ? Math.round((activeAssignments / totalAssignments) * 100)
        : 100;

      // Calculate assignment completion rate
      const completionRate = totalAssignments > 0
        ? Math.round((data.completedAssignments / totalAssignments) * 100)
        : 0;

      // Calculate assignment response time (time from creation to assignment)
      const responseTimeStats = this.calculateAssignmentResponseTime(
        data.creationTimes, 
        data.assignmentTimes
      );

      // Analyze category-specific performance
      const categoryPerformance = this.analyzeCategoryAssignmentPerformance(data.categoryAccuracy);

      // Privacy protection - return only performance metrics
      return {
        driverId: data._id,
        totalAssignments,
        completedAssignments: data.completedAssignments,
        rejectedAssignments: data.rejectedAssignments,
        inProgressAssignments: data.inProgressAssignments,
        pendingAssignments: data.pendingAssignments,
        
        // Assignment accuracy metrics
        assignmentAccuracy,
        completionRate,
        rejectionRate: totalAssignments > 0 
          ? Math.round((data.rejectedAssignments / totalAssignments) * 100)
          : 0,
        
        // Response time metrics
        averageResponseTime: responseTimeStats.average,
        medianResponseTime: responseTimeStats.median,
        
        // Category performance
        categoryPerformance,
        
        // Assignment efficiency score (composite metric)
        efficiencyScore: this.calculateAssignmentEfficiencyScore({
          accuracy: assignmentAccuracy,
          completion: completionRate,
          responseTime: responseTimeStats.average
        }),
        
        period
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - processAssignmentTrackingData:', error.message);
      return {
        driverId: data._id,
        totalAssignments: data.totalAssignments || 0,
        assignmentAccuracy: 0,
        completionRate: 0,
        efficiencyScore: 0,
        period,
        error: 'Processing failed'
      };
    }
  }

  /**
   * Calculate assignment response time statistics
   * @param {Array} creationTimes - Report creation timestamps
   * @param {Array} assignmentTimes - Assignment timestamps
   * @returns {Object} Response time statistics
   */
  calculateAssignmentResponseTime(creationTimes, assignmentTimes) {
    try {
      if (!creationTimes || !assignmentTimes || creationTimes.length !== assignmentTimes.length) {
        return { average: 0, median: 0, count: 0 };
      }

      const responseTimes = [];
      for (let i = 0; i < creationTimes.length; i++) {
        if (creationTimes[i] && assignmentTimes[i]) {
          const responseTime = new Date(assignmentTimes[i]) - new Date(creationTimes[i]);
          if (responseTime >= 0) {
            responseTimes.push(responseTime / (1000 * 60 * 60)); // Convert to hours
          }
        }
      }

      if (responseTimes.length === 0) {
        return { average: 0, median: 0, count: 0 };
      }

      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const median = sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
        : sortedTimes[Math.floor(sortedTimes.length / 2)];

      return {
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        count: responseTimes.length
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateAssignmentResponseTime:', error.message);
      return { average: 0, median: 0, count: 0 };
    }
  }

  /**
   * Analyze category-specific assignment performance
   * @param {Array} categoryData - Category and status data
   * @returns {Object} Category performance analysis
   */
  analyzeCategoryAssignmentPerformance(categoryData) {
    try {
      if (!categoryData || categoryData.length === 0) {
        return {
          recyclable: { total: 0, completed: 0, rate: 0 },
          illegal_dumping: { total: 0, completed: 0, rate: 0 },
          hazardous_waste: { total: 0, completed: 0, rate: 0 }
        };
      }

      const categoryStats = {
        recyclable: { total: 0, completed: 0 },
        illegal_dumping: { total: 0, completed: 0 },
        hazardous_waste: { total: 0, completed: 0 }
      };

      categoryData.forEach(item => {
        if (item.category && categoryStats[item.category]) {
          categoryStats[item.category].total++;
          if (item.status === 'Completed') {
            categoryStats[item.category].completed++;
          }
        }
      });

      // Calculate completion rates for each category
      Object.keys(categoryStats).forEach(category => {
        const stats = categoryStats[category];
        stats.rate = stats.total > 0 
          ? Math.round((stats.completed / stats.total) * 100)
          : 0;
      });

      return categoryStats;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - analyzeCategoryAssignmentPerformance:', error.message);
      return {
        recyclable: { total: 0, completed: 0, rate: 0 },
        illegal_dumping: { total: 0, completed: 0, rate: 0 },
        hazardous_waste: { total: 0, completed: 0, rate: 0 }
      };
    }
  }

  /**
   * Calculate composite assignment efficiency score
   * @param {Object} metrics - Assignment metrics
   * @returns {Number} Efficiency score (0-100)
   */
  calculateAssignmentEfficiencyScore(metrics) {
    try {
      const { accuracy, completion, responseTime } = metrics;
      
      // Normalize response time score (lower is better, cap at 24 hours)
      const maxResponseTime = 24; // hours
      const responseTimeScore = responseTime > 0 
        ? Math.max(0, 100 - ((responseTime / maxResponseTime) * 100))
        : 100;

      // Weighted composite score
      const weights = {
        accuracy: 0.4,    // 40% - assignment accuracy
        completion: 0.4,  // 40% - completion rate
        responseTime: 0.2 // 20% - response time
      };

      const compositeScore = 
        (accuracy * weights.accuracy) +
        (completion * weights.completion) +
        (responseTimeScore * weights.responseTime);

      return Math.round(compositeScore);

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateAssignmentEfficiencyScore:', error.message);
      return 0;
    }
  }

  /**
   * Calculate system-wide assignment metrics
   * @param {Array} driverTracking - Array of driver assignment tracking data
   * @returns {Object} System assignment metrics
   */
  calculateSystemAssignmentMetrics(driverTracking) {
    try {
      if (!driverTracking || driverTracking.length === 0) {
        return {
          totalAssignments: 0,
          systemAccuracy: 0,
          systemCompletionRate: 0,
          averageResponseTime: 0,
          efficiencyDistribution: { high: 0, medium: 0, low: 0 }
        };
      }

      const totalAssignments = driverTracking.reduce((sum, driver) => sum + driver.totalAssignments, 0);
      const totalCompleted = driverTracking.reduce((sum, driver) => sum + driver.completedAssignments, 0);
      const totalRejected = driverTracking.reduce((sum, driver) => sum + driver.rejectedAssignments, 0);

      const systemAccuracy = totalAssignments > 0 
        ? Math.round(((totalAssignments - totalRejected) / totalAssignments) * 100)
        : 100;

      const systemCompletionRate = totalAssignments > 0
        ? Math.round((totalCompleted / totalAssignments) * 100)
        : 0;

      const validResponseTimes = driverTracking
        .filter(d => d.averageResponseTime > 0)
        .map(d => d.averageResponseTime);
      const averageResponseTime = validResponseTimes.length > 0
        ? Math.round((validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length) * 100) / 100
        : 0;

      // Calculate efficiency distribution
      const efficiencyScores = driverTracking.map(d => d.efficiencyScore);
      const efficiencyDistribution = {
        high: efficiencyScores.filter(score => score >= 80).length,
        medium: efficiencyScores.filter(score => score >= 60 && score < 80).length,
        low: efficiencyScores.filter(score => score < 60).length
      };

      return {
        totalAssignments,
        systemAccuracy,
        systemCompletionRate,
        averageResponseTime,
        efficiencyDistribution
      };

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateSystemAssignmentMetrics:', error.message);
      return {
        totalAssignments: 0,
        systemAccuracy: 0,
        systemCompletionRate: 0,
        averageResponseTime: 0,
        efficiencyDistribution: { high: 0, medium: 0, low: 0 }
      };
    }
  }

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
   * Validate mathematical correctness of calculation results
   * @param {Object} results - Calculation results to validate
   * @param {String} calculationType - Type of calculation performed
   * @returns {Object} Validation result with corrections if needed
   */
  validateCalculationResults(results, calculationType) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      corrections: {},
      originalResults: { ...results }
    };

    try {
      switch (calculationType) {
        case 'percentage':
          this.validatePercentageResults(results, validation);
          break;
        case 'average':
          this.validateAverageResults(results, validation);
          break;
        case 'rate':
          this.validateRateResults(results, validation);
          break;
        case 'distribution':
          this.validateDistributionResults(results, validation);
          break;
        case 'trend':
          this.validateTrendResults(results, validation);
          break;
        default:
          validation.warnings.push(`Unknown calculation type: ${calculationType}`);
      }

      return validation;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - validateCalculationResults:', error.message);
      validation.isValid = false;
      validation.errors.push(`Validation error: ${error.message}`);
      return validation;
    }
  }

  /**
   * Validate percentage calculation results
   * @param {Object} results - Results to validate
   * @param {Object} validation - Validation object to update
   */
  validatePercentageResults(results, validation) {
    Object.entries(results).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (value < 0 || value > 100) {
          validation.warnings.push(`${key} percentage out of range: ${value}%`);
          validation.corrections[key] = Math.max(0, Math.min(100, value));
        }
        if (!isFinite(value) || isNaN(value)) {
          validation.errors.push(`${key} is not a valid number: ${value}`);
          validation.corrections[key] = 0;
        }
      }
    });
  }

  /**
   * Validate average calculation results
   * @param {Object} results - Results to validate
   * @param {Object} validation - Validation object to update
   */
  validateAverageResults(results, validation) {
    Object.entries(results).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (!isFinite(value) || isNaN(value)) {
          validation.errors.push(`${key} average is not a valid number: ${value}`);
          validation.corrections[key] = 0;
        }
        if (value < 0) {
          validation.warnings.push(`${key} average is negative: ${value}`);
        }
      }
    });
  }

  /**
   * Validate rate calculation results
   * @param {Object} results - Results to validate
   * @param {Object} validation - Validation object to update
   */
  validateRateResults(results, validation) {
    Object.entries(results).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (!isFinite(value) || isNaN(value)) {
          validation.errors.push(`${key} rate is not a valid number: ${value}`);
          validation.corrections[key] = 0;
        }
        if (value < 0) {
          validation.warnings.push(`${key} rate is negative: ${value}`);
        }
      }
    });
  }

  /**
   * Validate distribution calculation results
   * @param {Object} results - Results to validate
   * @param {Object} validation - Validation object to update
   */
  validateDistributionResults(results, validation) {
    if (results.statusDistribution && Array.isArray(results.statusDistribution)) {
      const totalPercentage = results.statusDistribution.reduce((sum, item) => sum + (item.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 1) { // Allow 1% tolerance for rounding
        validation.warnings.push(`Status distribution percentages don't sum to 100%: ${totalPercentage}%`);
      }
    }
  }

  /**
   * Validate trend calculation results
   * @param {Object} results - Results to validate
   * @param {Object} validation - Validation object to update
   */
  validateTrendResults(results, validation) {
    if (results.dailyTrends && Array.isArray(results.dailyTrends)) {
      results.dailyTrends.forEach((trend, index) => {
        if (!trend.date) {
          validation.errors.push(`Daily trend ${index} missing date`);
        }
        if (typeof trend.total !== 'number' || trend.total < 0) {
          validation.warnings.push(`Daily trend ${index} has invalid total: ${trend.total}`);
        }
      });
    }
  }

  /**
   * Calculate status time analytics from reports with status history
   * @param {Array} reports - Reports with status history
   * @returns {Object} Status time analytics
   */
  async calculateStatusTimeAnalytics(reports) {
    try {
      const statusTimeData = {};
      
      // Initialize status time tracking
      this.validStatuses.forEach(status => {
        statusTimeData[status] = {
          totalTime: 0,
          count: 0,
          averageTime: 0,
          minTime: Infinity,
          maxTime: 0,
          durations: []
        };
      });

      reports.forEach(report => {
        if (report.statusHistory && report.statusHistory.length > 0) {
          for (let i = 0; i < report.statusHistory.length; i++) {
            const currentStatus = report.statusHistory[i];
            const nextStatus = report.statusHistory[i + 1];
            
            const startTime = new Date(currentStatus.timestamp);
            const endTime = nextStatus 
              ? new Date(nextStatus.timestamp)
              : (report.updatedAt ? new Date(report.updatedAt) : new Date());

            const duration = (endTime - startTime) / (1000 * 60 * 60); // Hours

            if (duration >= 0 && statusTimeData[currentStatus.status]) {
              const statusData = statusTimeData[currentStatus.status];
              statusData.totalTime += duration;
              statusData.count++;
              statusData.durations.push(duration);
              statusData.minTime = Math.min(statusData.minTime, duration);
              statusData.maxTime = Math.max(statusData.maxTime, duration);
            }
          }
        }
      });

      // Calculate averages and clean up data
      Object.keys(statusTimeData).forEach(status => {
        const data = statusTimeData[status];
        if (data.count > 0) {
          data.averageTime = Math.round((data.totalTime / data.count) * 100) / 100;
          data.medianTime = this.calculateMedian(data.durations);
          data.minTime = data.minTime === Infinity ? 0 : Math.round(data.minTime * 100) / 100;
          data.maxTime = Math.round(data.maxTime * 100) / 100;
        } else {
          data.minTime = 0;
        }
        // Remove raw durations array to reduce response size
        delete data.durations;
      });

      return statusTimeData;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - calculateStatusTimeAnalytics:', error.message);
      return {};
    }
  }

  /**
   * Process trend data with enhanced formatting
   * @param {Array} trendData - Raw trend data from aggregation
   * @param {Object} dateRange - Date range for analysis
   * @returns {Object} Processed trend data
   */
  processTrendData(trendData, dateRange) {
    try {
      const processedData = {
        totalDays: 0,
        totalIncidents: 0,
        dailyTrends: [],
        categoryTotals: {},
        averagePerDay: 0,
        peakDay: null,
        trendDirection: 'stable'
      };

      if (!trendData || trendData.length === 0) {
        return processedData;
      }

      // Process daily trends
      const dailyMap = new Map();
      let totalIncidents = 0;

      trendData.forEach(item => {
        const date = item._id.date;
        const category = item._id.category;
        const count = item.count;

        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            total: 0,
            categories: {}
          });
        }

        const dayData = dailyMap.get(date);
        dayData.total += count;
        dayData.categories[category] = count;
        totalIncidents += count;

        // Track category totals
        processedData.categoryTotals[category] = (processedData.categoryTotals[category] || 0) + count;
      });

      // Convert to array and sort by date
      processedData.dailyTrends = Array.from(dailyMap.values())
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      processedData.totalDays = processedData.dailyTrends.length;
      processedData.totalIncidents = totalIncidents;
      processedData.averagePerDay = processedData.totalDays > 0 
        ? Math.round((totalIncidents / processedData.totalDays) * 100) / 100 
        : 0;

      // Find peak day
      if (processedData.dailyTrends.length > 0) {
        processedData.peakDay = processedData.dailyTrends.reduce((peak, day) => 
          day.total > peak.total ? day : peak
        );
      }

      // Calculate trend direction
      if (processedData.dailyTrends.length >= 2) {
        const firstHalf = processedData.dailyTrends.slice(0, Math.floor(processedData.dailyTrends.length / 2));
        const secondHalf = processedData.dailyTrends.slice(Math.floor(processedData.dailyTrends.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.total, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.total, 0) / secondHalf.length;
        
        const change = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        
        if (change > 10) {
          processedData.trendDirection = 'increasing';
        } else if (change < -10) {
          processedData.trendDirection = 'decreasing';
        } else {
          processedData.trendDirection = 'stable';
        }
      }

      return processedData;

    } catch (error) {
      console.error('[ERROR] Analytics Engine - processTrendData:', error.message);
      return {
        totalDays: 0,
        totalIncidents: 0,
        dailyTrends: [],
        categoryTotals: {},
        averagePerDay: 0,
        peakDay: null,
        trendDirection: 'stable'
      };
    }
  }
}

export default AnalyticsEngine;
