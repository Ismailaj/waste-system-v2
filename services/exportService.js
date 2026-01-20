import fs from 'fs';
import path from 'path';

/**
 * Export Service - Handles CSV and PDF generation for analytics data
 * Provides data export functionality with proper formatting and headers
 */
class ExportService {
  constructor() {
    this.supportedFormats = ['csv', 'pdf'];
    this.maxExportRecords = 10000; // Limit for performance
  }

  /**
   * Generate CSV export for analytics data
   * @param {String} dataType - Type of data (trends, geographic, drivers, status)
   * @param {Object} data - Analytics data to export
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with CSV content
   */
  async generateCSV(dataType, data, options = {}) {
    try {
      const { includeDetails = false, dateRange, filters } = options;
      
      let csvContent = '';
      let headers = [];
      let rows = [];

      switch (dataType) {
        case 'trends':
          ({ headers, rows } = this.formatTrendsForCSV(data, includeDetails));
          break;
        case 'geographic':
          ({ headers, rows } = this.formatGeographicForCSV(data, includeDetails));
          break;
        case 'drivers':
          ({ headers, rows } = this.formatDriversForCSV(data, includeDetails));
          break;
        case 'status':
          ({ headers, rows } = this.formatStatusForCSV(data, includeDetails));
          break;
        default:
          throw new Error(`Unsupported data type for CSV export: ${dataType}`);
      }

      // Build CSV content
      csvContent = this.buildCSVContent(headers, rows, {
        dataType,
        dateRange,
        filters,
        exportedAt: new Date().toISOString()
      });

      return {
        success: true,
        format: 'csv',
        content: csvContent,
        filename: this.generateFilename(dataType, 'csv', dateRange),
        recordCount: rows.length,
        exportedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ERROR] ExportService - generateCSV:', error.message);
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF export for analytics data (simplified implementation)
   * @param {String} dataType - Type of data
   * @param {Object} data - Analytics data to export
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with PDF info
   */
  async generatePDF(dataType, data, options = {}) {
    try {
      const { includeCharts = true, dateRange, filters } = options;
      
      // For now, return a structured data object that could be used by a PDF library
      // In a full implementation, this would use libraries like puppeteer or jsPDF
      const pdfData = {
        title: `CleanCity Analytics Report - ${this.formatDataType(dataType)}`,
        generatedAt: new Date().toISOString(),
        dateRange,
        filters,
        sections: []
      };

      switch (dataType) {
        case 'trends':
          pdfData.sections = this.formatTrendsForPDF(data, includeCharts);
          break;
        case 'geographic':
          pdfData.sections = this.formatGeographicForPDF(data, includeCharts);
          break;
        case 'drivers':
          pdfData.sections = this.formatDriversForPDF(data, includeCharts);
          break;
        case 'status':
          pdfData.sections = this.formatStatusForPDF(data, includeCharts);
          break;
        default:
          throw new Error(`Unsupported data type for PDF export: ${dataType}`);
      }

      return {
        success: true,
        format: 'pdf',
        data: pdfData,
        filename: this.generateFilename(dataType, 'pdf', dateRange),
        message: 'PDF data prepared (requires PDF generation library for actual file creation)',
        exportedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ERROR] ExportService - generatePDF:', error.message);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  /**
   * Format trends data for CSV export
   * @param {Object} data - Trends data
   * @param {Boolean} includeDetails - Include detailed information
   * @returns {Object} Headers and rows for CSV
   */
  formatTrendsForCSV(data, includeDetails) {
    const headers = ['Date', 'Total_Incidents', 'Recyclable', 'Illegal_Dumping', 'Hazardous_Waste'];
    
    if (includeDetails) {
      headers.push('Percentage_Change', 'Trend_Direction');
    }

    const rows = [];
    
    if (data.dailyData && Array.isArray(data.dailyData)) {
      data.dailyData.forEach(day => {
        const row = [
          day.date,
          day.total || 0,
          day.categories?.recyclable || 0,
          day.categories?.illegal_dumping || 0,
          day.categories?.hazardous_waste || 0
        ];

        if (includeDetails) {
          row.push(day.percentageChange || 0);
          row.push(day.trend || 'stable');
        }

        rows.push(row);
      });
    }

    return { headers, rows };
  }

  /**
   * Format geographic data for CSV export
   * @param {Object} data - Geographic data
   * @param {Boolean} includeDetails - Include detailed information
   * @returns {Object} Headers and rows for CSV
   */
  formatGeographicForCSV(data, includeDetails) {
    const headers = ['Latitude', 'Longitude', 'Incident_Count', 'Density', 'Primary_Category'];
    
    if (includeDetails) {
      headers.push('Recyclable_Count', 'Illegal_Dumping_Count', 'Hazardous_Waste_Count', 'Recent_Reports');
    }

    const rows = [];
    
    if (data.locations && Array.isArray(data.locations)) {
      data.locations.forEach(location => {
        const row = [
          location.coordinates?.[1] || '', // Latitude
          location.coordinates?.[0] || '', // Longitude
          location.incidentCount || 0,
          location.density || 0,
          this.getPrimaryCategory(location.categoryBreakdown)
        ];

        if (includeDetails) {
          const breakdown = location.categoryBreakdown || {};
          row.push(breakdown.recyclable || 0);
          row.push(breakdown.illegal_dumping || 0);
          row.push(breakdown.hazardous_waste || 0);
          row.push(location.topReports?.length || 0);
        }

        rows.push(row);
      });
    }

    return { headers, rows };
  }

  /**
   * Format driver performance data for CSV export
   * @param {Object} data - Driver performance data
   * @param {Boolean} includeDetails - Include detailed information
   * @returns {Object} Headers and rows for CSV
   */
  formatDriversForCSV(data, includeDetails) {
    const headers = ['Driver_ID', 'Assigned_Reports', 'Completed_Reports', 'Completion_Rate', 'Average_Resolution_Time'];
    
    if (includeDetails) {
      headers.push('Rejected_Reports', 'Rejection_Rate', 'In_Progress_Reports', 'Pending_Reports');
    }

    const rows = [];
    
    if (data.drivers && Array.isArray(data.drivers)) {
      data.drivers.forEach(driver => {
        const row = [
          driver.driverId || '',
          driver.assignedReports || 0,
          driver.completedReports || 0,
          `${driver.completionRate || 0}%`,
          `${driver.averageResolutionTime || 0} hours`
        ];

        if (includeDetails) {
          row.push(driver.rejectedReports || 0);
          row.push(`${driver.rejectionRate || 0}%`);
          row.push(driver.inProgressReports || 0);
          row.push(driver.pendingReports || 0);
        }

        rows.push(row);
      });
    }

    return { headers, rows };
  }

  /**
   * Format status distribution data for CSV export
   * @param {Object} data - Status data
   * @param {Boolean} includeDetails - Include detailed information
   * @returns {Object} Headers and rows for CSV
   */
  formatStatusForCSV(data, includeDetails) {
    const headers = ['Status', 'Count', 'Percentage', 'Average_Resolution_Time'];
    
    if (includeDetails) {
      headers.push('Category_Breakdown', 'Trend_Direction');
    }

    const rows = [];
    
    if (data.statusDistribution && Array.isArray(data.statusDistribution)) {
      data.statusDistribution.forEach(status => {
        const row = [
          status.status || '',
          status.count || 0,
          `${status.percentage || 0}%`,
          `${status.averageResolutionTime || 0} hours`
        ];

        if (includeDetails) {
          row.push('Mixed'); // Simplified category breakdown
          row.push(status.count > 0 ? 'stable' : 'none');
        }

        rows.push(row);
      });
    }

    return { headers, rows };
  }

  /**
   * Build CSV content with headers and metadata
   * @param {Array} headers - CSV headers
   * @param {Array} rows - CSV data rows
   * @param {Object} metadata - Export metadata
   * @returns {String} Complete CSV content
   */
  buildCSVContent(headers, rows, metadata) {
    let csvContent = '';
    
    // Add metadata header
    csvContent += `# CleanCity Analytics Export\n`;
    csvContent += `# Data Type: ${metadata.dataType}\n`;
    csvContent += `# Exported At: ${metadata.exportedAt}\n`;
    
    if (metadata.dateRange) {
      csvContent += `# Date Range: ${metadata.dateRange.startDate} to ${metadata.dateRange.endDate}\n`;
    }
    
    if (metadata.filters) {
      csvContent += `# Filters: ${JSON.stringify(metadata.filters)}\n`;
    }
    
    csvContent += `#\n`;

    // Add headers
    csvContent += headers.join(',') + '\n';

    // Add data rows
    rows.forEach(row => {
      const escapedRow = row.map(cell => {
        const cellStr = String(cell);
        // Escape cells containing commas, quotes, or newlines
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Format trends data for PDF export
   * @param {Object} data - Trends data
   * @param {Boolean} includeCharts - Include chart data
   * @returns {Array} PDF sections
   */
  formatTrendsForPDF(data, includeCharts) {
    const sections = [
      {
        type: 'summary',
        title: 'Trends Summary',
        content: {
          totalIncidents: data.totalIncidents || 0,
          totalDays: data.totalDays || 0,
          categoryTotals: data.categoryTotals || {}
        }
      }
    ];

    if (includeCharts && data.dailyData) {
      sections.push({
        type: 'chart',
        title: 'Daily Trends Chart',
        chartType: 'line',
        data: data.dailyData
      });
    }

    sections.push({
      type: 'table',
      title: 'Daily Breakdown',
      headers: ['Date', 'Total', 'Recyclable', 'Illegal Dumping', 'Hazardous Waste'],
      rows: data.dailyData?.map(day => [
        day.date,
        day.total,
        day.categories?.recyclable || 0,
        day.categories?.illegal_dumping || 0,
        day.categories?.hazardous_waste || 0
      ]) || []
    });

    return sections;
  }

  /**
   * Format geographic data for PDF export
   * @param {Object} data - Geographic data
   * @param {Boolean} includeCharts - Include chart data
   * @returns {Array} PDF sections
   */
  formatGeographicForPDF(data, includeCharts) {
    const sections = [
      {
        type: 'summary',
        title: 'Geographic Summary',
        content: {
          totalLocations: data.totalLocations || 0,
          totalIncidents: data.totalIncidents || 0,
          averageDensity: data.locations ? 
            Math.round((data.locations.reduce((sum, loc) => sum + (loc.density || 0), 0) / data.locations.length) * 100) / 100 : 0
        }
      }
    ];

    if (includeCharts && data.locations) {
      sections.push({
        type: 'map',
        title: 'Incident Distribution Map',
        data: data.locations.map(loc => ({
          coordinates: loc.coordinates,
          count: loc.incidentCount,
          density: loc.density
        }))
      });
    }

    return sections;
  }

  /**
   * Format driver performance data for PDF export
   * @param {Object} data - Driver performance data
   * @param {Boolean} includeCharts - Include chart data
   * @returns {Array} PDF sections
   */
  formatDriversForPDF(data, includeCharts) {
    const sections = [
      {
        type: 'summary',
        title: 'Driver Performance Summary',
        content: {
          totalDrivers: data.driverCount || 0,
          totalAssigned: data.totalAssigned || 0,
          totalCompleted: data.totalCompleted || 0,
          systemAverages: data.systemAverages || {}
        }
      }
    ];

    if (includeCharts && data.drivers) {
      sections.push({
        type: 'chart',
        title: 'Driver Performance Comparison',
        chartType: 'bar',
        data: data.drivers.map(driver => ({
          label: `Driver ${driver.driverId.substring(0, 8)}`,
          completionRate: driver.completionRate,
          averageTime: driver.averageResolutionTime
        }))
      });
    }

    return sections;
  }

  /**
   * Format status data for PDF export
   * @param {Object} data - Status data
   * @param {Boolean} includeCharts - Include chart data
   * @returns {Array} PDF sections
   */
  formatStatusForPDF(data, includeCharts) {
    const sections = [
      {
        type: 'summary',
        title: 'Status Distribution Summary',
        content: {
          totalReports: data.totalReports || 0,
          validReports: data.validReports || 0,
          completionRate: data.completionRate || 0,
          rejectionRate: data.rejectionRate || 0
        }
      }
    ];

    if (includeCharts && data.statusDistribution) {
      sections.push({
        type: 'chart',
        title: 'Status Distribution',
        chartType: 'pie',
        data: data.statusDistribution.map(status => ({
          label: status.status,
          value: status.count,
          percentage: status.percentage
        }))
      });
    }

    return sections;
  }

  // Helper methods

  /**
   * Generate filename for export
   * @param {String} dataType - Type of data
   * @param {String} format - Export format
   * @param {Object} dateRange - Date range
   * @returns {String} Generated filename
   */
  generateFilename(dataType, format, dateRange) {
    const timestamp = new Date().toISOString().split('T')[0];
    let filename = `cleancity_${dataType}_${timestamp}`;
    
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      const start = new Date(dateRange.startDate).toISOString().split('T')[0];
      const end = new Date(dateRange.endDate).toISOString().split('T')[0];
      filename += `_${start}_to_${end}`;
    }
    
    return `${filename}.${format}`;
  }

  /**
   * Format data type for display
   * @param {String} dataType - Data type
   * @returns {String} Formatted data type
   */
  formatDataType(dataType) {
    const typeMap = {
      trends: 'Trend Analysis',
      geographic: 'Geographic Distribution',
      drivers: 'Driver Performance',
      status: 'Status Distribution'
    };
    
    return typeMap[dataType] || dataType;
  }

  /**
   * Get primary category from category breakdown
   * @param {Object} categoryBreakdown - Category counts
   * @returns {String} Primary category
   */
  getPrimaryCategory(categoryBreakdown) {
    if (!categoryBreakdown || typeof categoryBreakdown !== 'object') {
      return 'mixed';
    }

    let maxCount = 0;
    let primaryCategory = 'mixed';

    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      if (count > maxCount) {
        maxCount = count;
        primaryCategory = category;
      }
    });

    return primaryCategory;
  }

  /**
   * Validate export request
   * @param {String} dataType - Data type
   * @param {String} format - Export format
   * @param {Object} data - Data to export
   * @returns {Object} Validation result
   */
  validateExportRequest(dataType, format, data) {
    const errors = [];

    if (!dataType) {
      errors.push('Data type is required');
    }

    if (!format || !this.supportedFormats.includes(format)) {
      errors.push(`Format must be one of: ${this.supportedFormats.join(', ')}`);
    }

    if (!data) {
      errors.push('Data is required for export');
    }

    // Check data size limits
    if (data && this.getDataSize(data) > this.maxExportRecords) {
      errors.push(`Data size exceeds maximum limit of ${this.maxExportRecords} records`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Estimate data size for export limits
   * @param {Object} data - Data to check
   * @returns {Number} Estimated record count
   */
  getDataSize(data) {
    if (!data) return 0;

    // Estimate based on data structure
    if (data.dailyData && Array.isArray(data.dailyData)) {
      return data.dailyData.length;
    }
    
    if (data.locations && Array.isArray(data.locations)) {
      return data.locations.length;
    }
    
    if (data.drivers && Array.isArray(data.drivers)) {
      return data.drivers.length;
    }
    
    if (data.statusDistribution && Array.isArray(data.statusDistribution)) {
      return data.statusDistribution.length;
    }

    return 1; // Default for single record exports
  }
}

export default ExportService;