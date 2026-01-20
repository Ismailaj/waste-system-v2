/**
 * Analytics Visualization Components - Chart.js and Leaflet.js integration for analytics dashboard
 * Handles rendering of charts, maps, and interactive visualizations
 */
class AnalyticsVisualization {
  constructor() {
    this.charts = new Map(); // Store chart instances
    this.maps = new Map(); // Store map instances
    this.defaultColors = {
      primary: '#3B82F6',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#06B6D4',
      secondary: '#6B7280'
    };
    
    this.categoryColors = {
      recyclable: '#10B981',
      illegal_dumping: '#EF4444',
      hazardous_waste: '#F59E0B',
      all: '#3B82F6'
    };

    this.statusColors = {
      'Pending': '#F59E0B',
      'Assigned': '#06B6D4',
      'In Progress': '#3B82F6',
      'Completed': '#10B981',
      'Rejected': '#EF4444'
    };

    this.isInitialized = false;
    this.init();
  }

  /**
   * Initialize visualization system
   */
  init() {
    try {
      // Set Chart.js defaults
      this.configureChartDefaults();
      this.isInitialized = true;
      
      console.log('[INFO] AnalyticsVisualization - Visualization system initialized');
    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - Initialization failed:', error.message);
    }
  }

  /**
   * Configure Chart.js default settings
   */
  configureChartDefaults() {
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = 'Public Sans, sans-serif';
      Chart.defaults.font.size = 12;
      Chart.defaults.color = '#374151';
      Chart.defaults.plugins.legend.position = 'bottom';
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.padding = 20;
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;
    }
  }

  /**
   * Render trend line chart
   * @param {Object} data - Trend data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderTrendChart(data, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      // Destroy existing chart if it exists
      this.destroyChart(containerId);

      const ctx = canvas.getContext('2d');
      
      // Process data for Chart.js
      const chartData = this.processTrendData(data);
      
      const config = {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            title: {
              display: true,
              text: options.title || 'Incident Trends Over Time',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#374151',
              borderWidth: 1,
              callbacks: {
                title: (context) => {
                  return `Date: ${context[0].label}`;
                },
                label: (context) => {
                  return `${context.dataset.label}: ${context.parsed.y} incidents`;
                },
                afterBody: (context) => {
                  const total = context.reduce((sum, item) => sum + item.parsed.y, 0);
                  return `Total: ${total} incidents`;
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Date'
              },
              grid: {
                display: false
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Number of Incidents'
              },
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          },
          elements: {
            line: {
              tension: 0.2,
              borderWidth: 3
            },
            point: {
              radius: 4,
              hoverRadius: 6,
              borderWidth: 2,
              backgroundColor: '#fff'
            }
          },
          ...options.chartOptions
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);

      console.log(`[INFO] AnalyticsVisualization - Trend chart rendered: ${containerId}`);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderTrendChart:', error.message);
      this.showChartError(containerId, 'Failed to render trend chart');
      return null;
    }
  }

  /**
   * Render status pie chart
   * @param {Object} data - Status distribution data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderStatusPieChart(data, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');
      
      const chartData = this.processStatusData(data);
      
      const config = {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Status Distribution',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const percentage = context.dataset.percentages[context.dataIndex];
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          },
          cutout: '50%',
          ...options.chartOptions
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);

      console.log(`[INFO] AnalyticsVisualization - Status pie chart rendered: ${containerId}`);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderStatusPieChart:', error.message);
      this.showChartError(containerId, 'Failed to render status chart');
      return null;
    }
  }

  /**
   * Render driver performance bar chart
   * @param {Object} data - Driver performance data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderDriverPerformanceBar(data, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');
      
      const chartData = this.processDriverData(data);
      
      const config = {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: options.horizontal ? 'y' : 'x',
          plugins: {
            title: {
              display: true,
              text: options.title || 'Driver Performance Comparison',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                title: (context) => {
                  return `Driver: ${context[0].label}`;
                },
                label: (context) => {
                  const metric = context.dataset.label;
                  const value = context.parsed.y || context.parsed.x;
                  
                  if (metric.includes('Rate')) {
                    return `${metric}: ${value}%`;
                  } else if (metric.includes('Time')) {
                    return `${metric}: ${value} hours`;
                  } else {
                    return `${metric}: ${value}`;
                  }
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: options.horizontal ? 'Performance Metric' : 'Drivers'
              },
              grid: {
                display: !options.horizontal
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: options.horizontal ? 'Drivers' : 'Performance Metric'
              },
              beginAtZero: true,
              grid: {
                display: options.horizontal
              }
            }
          },
          elements: {
            bar: {
              borderRadius: 4,
              borderSkipped: false
            }
          },
          ...options.chartOptions
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);

      console.log(`[INFO] AnalyticsVisualization - Driver performance chart rendered: ${containerId}`);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderDriverPerformanceBar:', error.message);
      this.showChartError(containerId, 'Failed to render driver performance chart');
      return null;
    }
  }

  /**
   * Render status bar chart (alternative to pie chart)
   * @param {Object} data - Status data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderStatusBarChart(data, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');
      
      const chartData = this.processStatusDataForBar(data);
      
      const config = {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Status Distribution (Count)',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                label: (context) => {
                  const status = context.label;
                  const count = context.parsed.y;
                  const percentage = context.dataset.percentages[context.dataIndex];
                  return `${status}: ${count} reports (${percentage}%)`;
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Status'
              },
              grid: {
                display: false
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Number of Reports'
              },
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          },
          elements: {
            bar: {
              borderRadius: 4,
              borderSkipped: false
            }
          },
          ...options.chartOptions
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);

      console.log(`[INFO] AnalyticsVisualization - Status bar chart rendered: ${containerId}`);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderStatusBarChart:', error.message);
      this.showChartError(containerId, 'Failed to render status bar chart');
      return null;
    }
  }

  /**
   * Render heat map visualization with Leaflet
   * @param {Array} coordinates - Array of coordinate data with intensity
   * @param {String} mapId - Map container element ID
   * @param {Object} options - Map options
   * @returns {Object} Map instance
   */
  renderHeatMap(coordinates, mapId, options = {}) {
    try {
      const mapContainer = document.getElementById(mapId);
      if (!mapContainer) {
        throw new Error(`Map container not found: ${mapId}`);
      }

      // Destroy existing map if it exists
      this.destroyMap(mapId);

      // Default map center (can be overridden by options)
      const defaultCenter = [39.8283, -98.5795]; // Geographic center of US
      const center = options.center || defaultCenter;
      const zoom = options.zoom || 4;

      // Initialize Leaflet map
      const map = L.map(mapId).setView(center, zoom);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(map);

      // Process coordinates for heat map
      if (coordinates && coordinates.length > 0) {
        this.addHeatMapLayer(map, coordinates, options);
        
        // Fit map to show all points
        if (coordinates.length > 0) {
          const group = new L.featureGroup(
            coordinates.map(coord => L.marker([coord.coordinates[1], coord.coordinates[0]]))
          );
          map.fitBounds(group.getBounds().pad(0.1));
        }
      }

      this.maps.set(mapId, map);

      console.log(`[INFO] AnalyticsVisualization - Heat map rendered: ${mapId}`);
      return map;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderHeatMap:', error.message);
      this.showMapError(mapId, 'Failed to render heat map');
      return null;
    }
  }

  /**
   * Render incident markers on map
   * @param {Array} reports - Array of report data with coordinates
   * @param {String} mapId - Map container element ID
   * @param {Object} options - Map options
   * @returns {Object} Map instance
   */
  renderIncidentMarkers(reports, mapId, options = {}) {
    try {
      const mapContainer = document.getElementById(mapId);
      if (!mapContainer) {
        throw new Error(`Map container not found: ${mapId}`);
      }

      this.destroyMap(mapId);

      const defaultCenter = [39.8283, -98.5795];
      const center = options.center || defaultCenter;
      const zoom = options.zoom || 4;

      const map = L.map(mapId).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(map);

      if (reports && reports.length > 0) {
        this.addIncidentMarkers(map, reports, options);
        
        // Fit map to show all markers
        const validReports = reports.filter(r => r.coordinates && r.coordinates.length === 2);
        if (validReports.length > 0) {
          const group = new L.featureGroup(
            validReports.map(report => L.marker([report.coordinates[1], report.coordinates[0]]))
          );
          map.fitBounds(group.getBounds().pad(0.1));
        }
      }

      this.maps.set(mapId, map);

      console.log(`[INFO] AnalyticsVisualization - Incident markers rendered: ${mapId}`);
      return map;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderIncidentMarkers:', error.message);
      this.showMapError(mapId, 'Failed to render incident markers');
      return null;
    }
  }

  // Data processing methods

  /**
   * Process trend data for Chart.js
   * @param {Object} data - Raw trend data
   * @returns {Object} Chart.js data structure
   */
  processTrendData(data) {
    if (!data || !data.dailyData) {
      return { labels: [], datasets: [] };
    }

    const labels = data.dailyData.map(day => {
      const date = new Date(day.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const datasets = [];

    // Total incidents line
    datasets.push({
      label: 'Total Incidents',
      data: data.dailyData.map(day => day.total || 0),
      borderColor: this.defaultColors.primary,
      backgroundColor: this.defaultColors.primary + '20',
      fill: false,
      tension: 0.2
    });

    // Category-specific lines
    const categories = ['recyclable', 'illegal_dumping', 'hazardous_waste'];
    categories.forEach(category => {
      if (data.categoryTotals && data.categoryTotals[category] > 0) {
        datasets.push({
          label: this.formatCategoryName(category),
          data: data.dailyData.map(day => day.categories?.[category] || 0),
          borderColor: this.categoryColors[category],
          backgroundColor: this.categoryColors[category] + '20',
          fill: false,
          tension: 0.2
        });
      }
    });

    return { labels, datasets };
  }

  /**
   * Process status data for pie chart
   * @param {Object} data - Raw status data
   * @returns {Object} Chart.js data structure
   */
  processStatusData(data) {
    if (!data || !data.statusDistribution) {
      return { labels: [], datasets: [] };
    }

    const labels = [];
    const values = [];
    const colors = [];
    const percentages = [];

    data.statusDistribution.forEach(status => {
      if (status.count > 0) {
        labels.push(status.status);
        values.push(status.count);
        colors.push(this.statusColors[status.status] || this.defaultColors.secondary);
        percentages.push(status.percentage || 0);
      }
    });

    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(color => color + 'CC'),
        borderWidth: 2,
        percentages // Store percentages for tooltip
      }]
    };
  }

  /**
   * Process status data for bar chart
   * @param {Object} data - Raw status data
   * @returns {Object} Chart.js data structure
   */
  processStatusDataForBar(data) {
    if (!data || !data.statusDistribution) {
      return { labels: [], datasets: [] };
    }

    const labels = [];
    const values = [];
    const colors = [];
    const percentages = [];

    data.statusDistribution.forEach(status => {
      labels.push(status.status);
      values.push(status.count || 0);
      colors.push(this.statusColors[status.status] || this.defaultColors.secondary);
      percentages.push(status.percentage || 0);
    });

    return {
      labels,
      datasets: [{
        label: 'Reports',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(color => color + 'CC'),
        borderWidth: 1,
        percentages // Store percentages for tooltip
      }]
    };
  }

  /**
   * Process driver data for bar chart
   * @param {Object} data - Raw driver data
   * @returns {Object} Chart.js data structure
   */
  processDriverData(data) {
    if (!data || !data.drivers) {
      return { labels: [], datasets: [] };
    }

    // Limit to top 10 drivers for readability and privacy
    const topDrivers = data.drivers.slice(0, 10);
    
    // Privacy-compliant labels - use anonymized identifiers
    const labels = topDrivers.map((driver, index) => 
      `Driver ${String.fromCharCode(65 + index)}`
    );

    const datasets = [
      {
        label: 'Completion Rate (%)',
        data: topDrivers.map(driver => Math.round((driver.completionRate || 0) * 10) / 10),
        backgroundColor: this.defaultColors.success + '80',
        borderColor: this.defaultColors.success,
        borderWidth: 1,
        yAxisID: 'y'
      },
      {
        label: 'Average Resolution Time (hours)',
        data: topDrivers.map(driver => Math.round((driver.averageResolutionTime || 0) * 10) / 10),
        backgroundColor: this.defaultColors.info + '80',
        borderColor: this.defaultColors.info,
        borderWidth: 1,
        yAxisID: 'y1'
      }
    ];

    return { labels, datasets };
  }

  /**
   * Render driver performance ranking chart
   * @param {Object} data - Driver ranking data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderDriverRankingChart(data, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');
      
      const chartData = this.processDriverRankingData(data);
      
      const config = {
        type: 'radar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Driver Performance Radar',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                label: (context) => {
                  const metric = context.label;
                  const value = context.parsed.r;
                  return `${metric}: ${value}%`;
                }
              }
            }
          },
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks: {
                stepSize: 20
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              angleLines: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          },
          elements: {
            line: {
              borderWidth: 2
            },
            point: {
              radius: 4,
              hoverRadius: 6
            }
          },
          ...options.chartOptions
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);

      console.log(`[INFO] AnalyticsVisualization - Driver ranking chart rendered: ${containerId}`);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderDriverRankingChart:', error.message);
      this.showChartError(containerId, 'Failed to render driver ranking chart');
      return null;
    }
  }

  /**
   * Render driver efficiency comparison chart
   * @param {Object} data - Driver efficiency data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderDriverEfficiencyChart(data, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');
      
      const chartData = this.processDriverEfficiencyData(data);
      
      const config = {
        type: 'scatter',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Driver Efficiency Matrix',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                title: () => 'Driver Performance',
                label: (context) => {
                  const point = context.parsed;
                  return [
                    `Completion Rate: ${point.x}%`,
                    `Efficiency Score: ${point.y}%`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Completion Rate (%)'
              },
              min: 0,
              max: 100,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Efficiency Score (%)'
              },
              min: 0,
              max: 100,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          },
          elements: {
            point: {
              radius: 8,
              hoverRadius: 12,
              borderWidth: 2,
              backgroundColor: this.defaultColors.primary + '80',
              borderColor: this.defaultColors.primary
            }
          },
          ...options.chartOptions
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);

      console.log(`[INFO] AnalyticsVisualization - Driver efficiency chart rendered: ${containerId}`);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderDriverEfficiencyChart:', error.message);
      this.showChartError(containerId, 'Failed to render driver efficiency chart');
      return null;
    }
  }

  /**
   * Process driver ranking data for radar chart
   * @param {Object} data - Raw driver ranking data
   * @returns {Object} Chart.js data structure
   */
  processDriverRankingData(data) {
    if (!data || !data.targetDriver) {
      return { labels: [], datasets: [] };
    }

    const metrics = [
      'Completion Rate',
      'Resolution Speed',
      'Assignment Accuracy',
      'Quality Score',
      'Consistency'
    ];

    const targetDriver = data.targetDriver;
    const systemAverage = data.systemAverages || {};

    const datasets = [
      {
        label: 'Selected Driver',
        data: [
          targetDriver.completionRate || 0,
          targetDriver.resolutionSpeedScore || 0,
          targetDriver.assignmentAccuracy || 0,
          targetDriver.qualityScore || 0,
          targetDriver.consistencyScore || 0
        ],
        backgroundColor: this.defaultColors.primary + '20',
        borderColor: this.defaultColors.primary,
        borderWidth: 2
      },
      {
        label: 'System Average',
        data: [
          systemAverage.completionRate || 0,
          systemAverage.resolutionSpeedScore || 0,
          systemAverage.assignmentAccuracy || 0,
          systemAverage.qualityScore || 0,
          systemAverage.consistencyScore || 0
        ],
        backgroundColor: this.defaultColors.secondary + '20',
        borderColor: this.defaultColors.secondary,
        borderWidth: 2
      }
    ];

    return { labels: metrics, datasets };
  }

  /**
   * Process driver efficiency data for scatter plot
   * @param {Object} data - Raw driver efficiency data
   * @returns {Object} Chart.js data structure
   */
  processDriverEfficiencyData(data) {
    if (!data || !data.drivers) {
      return { labels: [], datasets: [] };
    }

    // Privacy-compliant: only show performance metrics, no identifying information
    const scatterData = data.drivers.map(driver => ({
      x: Math.round((driver.completionRate || 0) * 10) / 10,
      y: Math.round((driver.efficiencyScore || 0) * 10) / 10
    }));

    const datasets = [
      {
        label: 'Driver Performance',
        data: scatterData,
        backgroundColor: this.defaultColors.primary + '60',
        borderColor: this.defaultColors.primary,
        borderWidth: 2
      }
    ];

    // Add quadrant lines for performance categories
    if (data.systemAverages) {
      const avgCompletion = data.systemAverages.completionRate || 50;
      const avgEfficiency = data.systemAverages.efficiencyScore || 50;

      datasets.push({
        label: 'System Average',
        data: [{ x: avgCompletion, y: avgEfficiency }],
        backgroundColor: this.defaultColors.warning,
        borderColor: this.defaultColors.warning,
        borderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false
      });
    }

    return { labels: [], datasets };
  }

  // Map helper methods

  /**
   * Add heat map layer to Leaflet map
   * @param {Object} map - Leaflet map instance
   * @param {Array} coordinates - Coordinate data with intensity
   * @param {Object} options - Heat map options
   */
  addHeatMapLayer(map, coordinates, options) {
    // For now, use circle markers to simulate heat map
    // In a full implementation, you'd use a heat map plugin like Leaflet.heat
    
    coordinates.forEach(coord => {
      if (coord.coordinates && coord.coordinates.length === 2) {
        const intensity = coord.intensity || coord.incidentCount || 1;
        const radius = Math.max(5, Math.min(20, intensity * 2));
        
        const circle = L.circleMarker([coord.coordinates[1], coord.coordinates[0]], {
          radius: radius,
          fillColor: this.getIntensityColor(intensity),
          color: '#fff',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6
        });

        circle.bindPopup(`
          <div class="p-2">
            <strong>Incident Cluster</strong><br>
            Count: ${intensity}<br>
            Location: ${coord.coordinates[1].toFixed(4)}, ${coord.coordinates[0].toFixed(4)}
          </div>
        `);

        circle.addTo(map);
      }
    });
  }

  /**
   * Add incident markers to Leaflet map
   * @param {Object} map - Leaflet map instance
   * @param {Array} reports - Report data
   * @param {Object} options - Marker options
   */
  addIncidentMarkers(map, reports, options) {
    reports.forEach(report => {
      if (report.coordinates && report.coordinates.length === 2) {
        const marker = L.marker([report.coordinates[1], report.coordinates[0]]);
        
        const popupContent = `
          <div class="p-3 max-w-xs">
            <div class="flex items-center mb-2">
              <span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: ${this.categoryColors[report.category] || this.defaultColors.secondary}"></span>
              <strong>${this.formatCategoryName(report.category)}</strong>
            </div>
            <p class="text-sm text-gray-600 mb-2">${report.description || 'No description available'}</p>
            <div class="text-xs text-gray-500">
              <div>Status: <span class="font-medium">${report.status}</span></div>
              <div>Date: ${new Date(report.createdAt).toLocaleDateString()}</div>
              ${report.incidentCount ? `<div>Incidents: ${report.incidentCount}</div>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(map);
      }
    });
  }

  // Workflow visualization methods

  /**
   * Render status transition flow chart
   * @param {Array} transitionStats - Status transition statistics
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderTransitionFlowChart(transitionStats, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');

      // Process transition data for sankey-style visualization using bar chart
      const labels = transitionStats.map(stat => `${stat.fromStatus} → ${stat.toStatus}`);
      const data = transitionStats.map(stat => stat.count);
      const avgTimes = transitionStats.map(stat => stat.averageTime);

      const chartData = {
        labels,
        datasets: [{
          label: 'Transition Count',
          data,
          backgroundColor: transitionStats.map(stat => this.statusColors[stat.fromStatus] || this.defaultColors.primary),
          borderColor: transitionStats.map(stat => this.statusColors[stat.fromStatus] || this.defaultColors.primary),
          borderWidth: 1
        }]
      };

      const config = {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            title: {
              display: true,
              text: options.title || 'Status Transitions'
            },
            tooltip: {
              callbacks: {
                afterLabel: (context) => {
                  const index = context.dataIndex;
                  return `Average Time: ${avgTimes[index].toFixed(1)} hours`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Transitions'
              }
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderTransitionFlowChart:', error.message);
      this.showChartError(containerId, 'Failed to load transition flow chart');
      return null;
    }
  }

  /**
   * Render common workflow paths chart
   * @param {Array} commonPaths - Common workflow paths data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderCommonPathsChart(commonPaths, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');

      const labels = commonPaths.slice(0, 10).map(path => path.path.replace(' -> ', ' → '));
      const data = commonPaths.slice(0, 10).map(path => path.count);
      const percentages = commonPaths.slice(0, 10).map(path => path.percentage);

      const chartData = {
        labels,
        datasets: [{
          label: 'Path Frequency',
          data,
          backgroundColor: this.generateColorPalette(labels.length),
          borderWidth: 1
        }]
      };

      const config = {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Most Common Workflow Paths'
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const index = context.dataIndex;
                  return `${context.label}: ${context.parsed} reports (${percentages[index]}%)`;
                }
              }
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderCommonPathsChart:', error.message);
      this.showChartError(containerId, 'Failed to load workflow paths chart');
      return null;
    }
  }

  /**
   * Render status time analytics chart
   * @param {Object} statusTimeData - Status time analytics data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderStatusTimeChart(statusTimeData, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');

      const statuses = Object.keys(statusTimeData);
      const avgTimes = statuses.map(status => statusTimeData[status].averageTime);
      const medianTimes = statuses.map(status => statusTimeData[status].medianTime);

      const chartData = {
        labels: statuses,
        datasets: [
          {
            label: 'Average Time',
            data: avgTimes,
            backgroundColor: this.defaultColors.primary,
            borderColor: this.defaultColors.primary,
            borderWidth: 1
          },
          {
            label: 'Median Time',
            data: medianTimes,
            backgroundColor: this.defaultColors.success,
            borderColor: this.defaultColors.success,
            borderWidth: 1
          }
        ]
      };

      const config = {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Time Spent in Each Status'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Time (hours)'
              }
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderStatusTimeChart:', error.message);
      this.showChartError(containerId, 'Failed to load status time chart');
      return null;
    }
  }

  /**
   * Render workflow timeline chart
   * @param {Array} timelineData - Timeline data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderTimelineChart(timelineData, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');

      const labels = timelineData.map(item => item.period);
      const totalEvents = timelineData.map(item => item.totalEvents);
      const avgDuration = timelineData.map(item => item.averageDuration);

      const chartData = {
        labels,
        datasets: [
          {
            label: 'Total Events',
            data: totalEvents,
            backgroundColor: this.defaultColors.primary,
            borderColor: this.defaultColors.primary,
            borderWidth: 2,
            fill: false,
            yAxisID: 'y'
          },
          {
            label: 'Avg Duration (hours)',
            data: avgDuration,
            backgroundColor: this.defaultColors.warning,
            borderColor: this.defaultColors.warning,
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1'
          }
        ]
      };

      const config = {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Workflow Activity Timeline'
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Number of Events'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Average Duration (hours)'
              },
              grid: {
                drawOnChartArea: false,
              },
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderTimelineChart:', error.message);
      this.showChartError(containerId, 'Failed to load timeline chart');
      return null;
    }
  }

  /**
   * Render workflow efficiency metrics chart
   * @param {Object} efficiencyData - Efficiency metrics data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderEfficiencyMetrics(efficiencyData, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');

      const categories = Object.keys(efficiencyData.categoryEfficiency || {});
      const avgDurations = categories.map(cat => efficiencyData.categoryEfficiency[cat].averageDuration);
      const completionRates = categories.map(cat => efficiencyData.categoryEfficiency[cat].completionRate);

      const chartData = {
        labels: categories.map(cat => this.formatCategoryName(cat)),
        datasets: [
          {
            label: 'Avg Duration (hours)',
            data: avgDurations,
            backgroundColor: this.defaultColors.info,
            borderColor: this.defaultColors.info,
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: 'Completion Rate (%)',
            data: completionRates,
            backgroundColor: this.defaultColors.success,
            borderColor: this.defaultColors.success,
            borderWidth: 1,
            yAxisID: 'y1'
          }
        ]
      };

      const config = {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Efficiency by Category'
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Duration (hours)'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Completion Rate (%)'
              },
              grid: {
                drawOnChartArea: false,
              },
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderEfficiencyMetrics:', error.message);
      this.showChartError(containerId, 'Failed to load efficiency metrics chart');
      return null;
    }
  }

  /**
   * Render workflow bottlenecks chart
   * @param {Array} bottlenecks - Bottlenecks data
   * @param {String} containerId - Container element ID
   * @param {Object} options - Chart options
   * @returns {Object} Chart instance
   */
  renderBottlenecksChart(bottlenecks, containerId, options = {}) {
    try {
      const canvas = document.getElementById(containerId);
      if (!canvas) {
        throw new Error(`Canvas element not found: ${containerId}`);
      }

      this.destroyChart(containerId);
      const ctx = canvas.getContext('2d');

      const labels = bottlenecks.map(b => b.status);
      const severities = bottlenecks.map(b => b.severity);
      const avgDurations = bottlenecks.map(b => b.metrics.averageDuration);

      // Color based on severity
      const colors = severities.map(severity => {
        if (severity >= 70) return this.defaultColors.danger;
        if (severity >= 40) return this.defaultColors.warning;
        return this.defaultColors.info;
      });

      const chartData = {
        labels,
        datasets: [{
          label: 'Severity Score',
          data: severities,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }]
      };

      const config = {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: options.title || 'Bottleneck Severity by Status'
            },
            tooltip: {
              callbacks: {
                afterLabel: (context) => {
                  const index = context.dataIndex;
                  return `Avg Duration: ${avgDurations[index].toFixed(1)} hours`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Severity Score (0-100)'
              }
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('[ERROR] AnalyticsVisualization - renderBottlenecksChart:', error.message);
      this.showChartError(containerId, 'Failed to load bottlenecks chart');
      return null;
    }
  }

  /**
   * Generate color palette for charts
   * @param {Number} count - Number of colors needed
   * @returns {Array} Array of color hex codes
   */
  generateColorPalette(count) {
    const baseColors = [
      this.defaultColors.primary,
      this.defaultColors.success,
      this.defaultColors.warning,
      this.defaultColors.danger,
      this.defaultColors.info,
      this.defaultColors.secondary
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  // Utility methods

  /**
   * Get color based on intensity value
   * @param {Number} intensity - Intensity value
   * @returns {String} Color hex code
   */
  getIntensityColor(intensity) {
    if (intensity <= 1) return '#10B981'; // Green
    if (intensity <= 3) return '#F59E0B'; // Yellow
    if (intensity <= 5) return '#EF4444'; // Red
    return '#7C2D12'; // Dark red
  }

  /**
   * Format category name for display
   * @param {String} category - Category key
   * @returns {String} Formatted category name
   */
  formatCategoryName(category) {
    const categoryNames = {
      recyclable: 'Recyclable',
      illegal_dumping: 'Illegal Dumping',
      hazardous_waste: 'Hazardous Waste',
      all: 'All Categories'
    };
    
    return categoryNames[category] || category;
  }

  /**
   * Add hover tooltips to chart
   * @param {Object} chart - Chart.js instance
   * @param {Object} options - Tooltip options
   */
  addHoverTooltips(chart, options = {}) {
    if (!chart || !chart.options) return;

    chart.options.plugins.tooltip = {
      ...chart.options.plugins.tooltip,
      enabled: true,
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#374151',
      borderWidth: 1,
      ...options
    };

    chart.update();
  }

  /**
   * Enable clickable data points
   * @param {Object} chart - Chart.js instance
   * @param {Function} onClick - Click handler function
   */
  enableClickableDataPoints(chart, onClick) {
    if (!chart || typeof onClick !== 'function') return;

    chart.options.onClick = (event, elements) => {
      if (elements.length > 0) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const dataset = chart.data.datasets[datasetIndex];
        const value = dataset.data[index];
        const label = chart.data.labels[index];

        onClick({
          datasetIndex,
          index,
          value,
          label,
          dataset: dataset.label,
          element
        });
      }
    };

    chart.update();
  }

  /**
   * Destroy chart instance
   * @param {String} containerId - Container element ID
   */
  destroyChart(containerId) {
    const existingChart = this.charts.get(containerId);
    if (existingChart) {
      existingChart.destroy();
      this.charts.delete(containerId);
    }
  }

  /**
   * Destroy map instance
   * @param {String} mapId - Map container element ID
   */
  destroyMap(mapId) {
    const existingMap = this.maps.get(mapId);
    if (existingMap) {
      existingMap.remove();
      this.maps.delete(mapId);
    }
  }

  /**
   * Show chart error message
   * @param {String} containerId - Container element ID
   * @param {String} message - Error message
   */
  showChartError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container && container.parentElement) {
      container.parentElement.innerHTML = `
        <div class="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <div class="text-center">
            <span class="material-symbols-outlined text-gray-400 text-4xl mb-2">error</span>
            <p class="text-gray-600">${message}</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Show map error message
   * @param {String} mapId - Map container element ID
   * @param {String} message - Error message
   */
  showMapError(mapId, message) {
    const container = document.getElementById(mapId);
    if (container) {
      container.innerHTML = `
        <div class="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div class="text-center">
            <span class="material-symbols-outlined text-gray-400 text-4xl mb-2">map</span>
            <p class="text-gray-600">${message}</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Update chart data
   * @param {String} containerId - Container element ID
   * @param {Object} newData - New data for the chart
   */
  updateChartData(containerId, newData) {
    const chart = this.charts.get(containerId);
    if (chart && newData) {
      chart.data = newData;
      chart.update('active');
    }
  }

  /**
   * Get chart instance
   * @param {String} containerId - Container element ID
   * @returns {Object|null} Chart instance
   */
  getChart(containerId) {
    return this.charts.get(containerId) || null;
  }

  /**
   * Get map instance
   * @param {String} mapId - Map container element ID
   * @returns {Object|null} Map instance
   */
  getMap(mapId) {
    return this.maps.get(mapId) || null;
  }

  /**
   * Destroy all charts and maps
   */
  destroyAll() {
    // Destroy all charts
    this.charts.forEach((chart, containerId) => {
      chart.destroy();
    });
    this.charts.clear();

    // Destroy all maps
    this.maps.forEach((map, mapId) => {
      map.remove();
    });
    this.maps.clear();

    console.log('[INFO] AnalyticsVisualization - All visualizations destroyed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsVisualization;
} else if (typeof window !== 'undefined') {
  window.AnalyticsVisualization = AnalyticsVisualization;
}