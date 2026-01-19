/**
 * Admin Analytics Dashboard Controller - Main controller for analytics dashboard
 * Coordinates between filters, API calls, and visualizations
 */
class AdminAnalyticsDashboard {
  constructor() {
    this.filters = null;
    this.visualization = null;
    this.currentTab = 'trends';
    this.isLoading = false;
    this.lastUpdated = null;
    this.refreshInterval = null;
    this.connectionRetryInterval = null;
    this.refreshIntervalMs = 5 * 60 * 1000; // 5 minutes
    
    // API endpoints
    this.apiBase = '/api/analytics';
    this.endpoints = {
      trends: `${this.apiBase}/trends`,
      trendsComparison: `${this.apiBase}/trends/comparison`,
      geographic: `${this.apiBase}/geographic`,
      heatmap: `${this.apiBase}/heatmap`,
      drivers: `${this.apiBase}/drivers`,
      status: `${this.apiBase}/status-distribution`,
      statusTransitions: `${this.apiBase}/status-transitions`,
      workflowTimeline: `${this.apiBase}/workflow-timeline`,
      workflowBottlenecks: `${this.apiBase}/workflow-bottlenecks`,
      resolution: `${this.apiBase}/resolution-times`,
      exportCSV: `${this.apiBase}/export/csv`,
      exportPDF: `${this.apiBase}/export/pdf`,
      health: `${this.apiBase}/health`
    };

    // Cache for analytics data
    this.dataCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Error handling
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second

    // Data quality tracking
    this.dataQuality = {
      totalRecords: 0,
      validRecords: 0,
      excludedRecords: 0,
      qualityScore: 0
    };

    this.init();
  }

  /**
   * Initialize the analytics dashboard
   */
  async init() {
    try {
      console.log('[INFO] AdminAnalyticsDashboard - Initializing dashboard...');
      
      // Initialize components
      await this.initializeComponents();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check authentication
      await this.checkAuthentication();
      
      // Load initial data
      await this.loadInitialData();
      
      // Start auto-refresh
      this.startAutoRefresh();
      
      console.log('[INFO] AdminAnalyticsDashboard - Dashboard initialized successfully');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Initialization failed:', error.message);
      this.showError('Failed to initialize analytics dashboard');
    }
  }

  /**
   * Initialize filter and visualization components
   */
  async initializeComponents() {
    try {
      // Initialize filters
      this.filters = new AnalyticsFilters();
      
      // Set up filter callbacks
      this.filters.setCallbacks({
        onFilterChange: (filters) => this.handleFilterChange(filters),
        onFilterApply: (filters) => this.handleFilterApply(filters),
        onFilterClear: () => this.handleFilterClear()
      });

      // Initialize visualization
      this.visualization = new AnalyticsVisualization();

      console.log('[INFO] AdminAnalyticsDashboard - Components initialized');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Component initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Set up event listeners for dashboard controls
   */
  setupEventListeners() {
    try {
      // Tab navigation
      const tabButtons = document.querySelectorAll('.analytics-tab');
      tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const tabName = e.target.getAttribute('data-tab') || e.target.closest('.analytics-tab').getAttribute('data-tab');
          this.switchTab(tabName);
        });
      });

      // Refresh button
      const refreshButton = document.getElementById('refresh-data');
      if (refreshButton) {
        refreshButton.addEventListener('click', () => this.refreshData());
      }

      // Export buttons
      this.setupExportListeners();

      // Logout button
      const logoutButton = document.getElementById('logout-btn');
      if (logoutButton) {
        logoutButton.addEventListener('click', () => this.handleLogout());
      }

      // Driver period selector
      const driverPeriodSelect = document.getElementById('driver-period');
      if (driverPeriodSelect) {
        driverPeriodSelect.addEventListener('change', (e) => {
          this.handleDriverPeriodChange(e.target.value);
        });
      }

      // Driver view selector
      const driverViewSelect = document.getElementById('driver-view');
      if (driverViewSelect) {
        driverViewSelect.addEventListener('change', (e) => {
          this.handleDriverViewChange(e.target.value);
        });
      }

      // Window events
      window.addEventListener('beforeunload', () => this.cleanup());
      window.addEventListener('focus', () => this.handleWindowFocus());

      console.log('[INFO] AdminAnalyticsDashboard - Event listeners set up');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Event listener setup failed:', error.message);
    }
  }

  /**
   * Set up export button listeners
   */
  setupExportListeners() {
    const exportButtons = [
      { id: 'export-trends-csv', type: 'csv', section: 'trends' },
      { id: 'export-trends-pdf', type: 'pdf', section: 'trends' },
      { id: 'export-geographic-csv', type: 'csv', section: 'geographic' },
      { id: 'export-drivers-csv', type: 'csv', section: 'drivers' },
      { id: 'export-status-csv', type: 'csv', section: 'status' }
    ];

    exportButtons.forEach(({ id, type, section }) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', () => this.handleExport(section, type));
      }
    });
  }

  /**
   * Check user authentication
   */
  async checkAuthentication() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Verify token with a simple API call
      const response = await this.makeAPICall(this.endpoints.health, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error('Authentication verification failed');
      }

      console.log('[INFO] AdminAnalyticsDashboard - Authentication verified');
      
      // Check system health
      await this.checkSystemHealth(response);
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Authentication failed:', error.message);
      this.handleAuthenticationFailure();
    }
  }

  /**
   * Check system health and display warnings if needed
   * @param {Object} healthResponse - Health check response
   */
  async checkSystemHealth(healthResponse) {
    try {
      if (healthResponse.data && healthResponse.data.systemHealth) {
        const health = healthResponse.data.systemHealth;
        
        // Check database connection
        if (health.database === 'disconnected' || health.database === 'slow') {
          this.showSystemWarning('Database connection issues detected. Some features may be slower than usual.');
        }
        
        // Check cache status
        if (health.cache === 'unavailable') {
          this.showSystemWarning('Cache service unavailable. Data loading may be slower.');
        }
        
        // Check data freshness
        if (health.dataFreshness && health.dataFreshness > 30) {
          this.showSystemWarning(`Analytics data is ${health.dataFreshness} minutes old. Consider refreshing for latest information.`);
        }
        
        console.log('[INFO] AdminAnalyticsDashboard - System health checked:', health);
      }
    } catch (error) {
      console.warn('[WARN] AdminAnalyticsDashboard - System health check failed:', error.message);
    }
  }

  /**
   * Show system warning message
   * @param {String} message - Warning message
   */
  showSystemWarning(message) {
    // Create or update system warning
    let warningElement = document.getElementById('system-warning');
    
    if (!warningElement) {
      warningElement = document.createElement('div');
      warningElement.id = 'system-warning';
      warningElement.className = 'bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6';
      warningElement.innerHTML = `
        <div class="flex">
          <div class="flex-shrink-0">
            <span class="material-symbols-outlined text-yellow-400">warning</span>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-800">System Notice</h3>
            <div class="mt-2 text-sm text-yellow-700">
              <p id="system-warning-text"></p>
            </div>
            <div class="mt-3">
              <button id="dismiss-warning" class="text-sm font-medium text-yellow-800 hover:text-yellow-900">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Insert after filters section
      const filtersSection = document.querySelector('.bg-white.shadow.rounded-lg');
      if (filtersSection && filtersSection.nextSibling) {
        filtersSection.parentNode.insertBefore(warningElement, filtersSection.nextSibling);
      }
      
      // Add dismiss functionality
      const dismissButton = warningElement.querySelector('#dismiss-warning');
      if (dismissButton) {
        dismissButton.addEventListener('click', () => {
          warningElement.remove();
        });
      }
    }
    
    const warningText = document.getElementById('system-warning-text');
    if (warningText) {
      warningText.textContent = message;
    }
  }

  /**
   * Load initial dashboard data
   */
  async loadInitialData() {
    try {
      this.showLoading(true);
      
      // Load data for current tab
      await this.loadTabData(this.currentTab);
      
      // Update last updated timestamp
      this.updateLastUpdatedTimestamp();
      
      console.log('[INFO] AdminAnalyticsDashboard - Initial data loaded');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Initial data loading failed:', error.message);
      this.showError('Failed to load initial data');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Switch between analytics tabs
   * @param {String} tabName - Name of the tab to switch to
   */
  async switchTab(tabName) {
    try {
      if (this.currentTab === tabName) return;

      console.log(`[INFO] AdminAnalyticsDashboard - Switching to tab: ${tabName}`);

      // Update UI
      this.updateTabUI(tabName);
      
      // Update current tab
      this.currentTab = tabName;
      
      // Load tab data
      await this.loadTabData(tabName);
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Tab switch failed:', error.message);
      this.showError(`Failed to load ${tabName} data`);
    }
  }

  /**
   * Update tab UI state
   * @param {String} activeTab - Active tab name
   */
  updateTabUI(activeTab) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.analytics-tab');
    tabButtons.forEach(button => {
      const tabName = button.getAttribute('data-tab');
      if (tabName === activeTab) {
        button.classList.add('active', 'border-blue-500', 'text-blue-600');
        button.classList.remove('border-transparent', 'text-gray-500');
      } else {
        button.classList.remove('active', 'border-blue-500', 'text-blue-600');
        button.classList.add('border-transparent', 'text-gray-500');
      }
    });

    // Update tab content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      const contentId = content.id.replace('-content', '');
      if (contentId === activeTab) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  /**
   * Load data for specific tab
   * @param {String} tabName - Tab name
   */
  async loadTabData(tabName) {
    try {
      this.showLoading(true);

      const activeFilters = this.filters.getActiveFilters();
      
      switch (tabName) {
        case 'trends':
          await this.loadTrendsData(activeFilters);
          break;
        case 'geographic':
          await this.loadGeographicData(activeFilters);
          break;
        case 'drivers':
          await this.loadDriversData(activeFilters);
          break;
        case 'status':
          await this.loadStatusData(activeFilters);
          break;
        case 'workflow':
          await this.loadWorkflowData(activeFilters);
          break;
        default:
          throw new Error(`Unknown tab: ${tabName}`);
      }

    } catch (error) {
      console.error(`[ERROR] AdminAnalyticsDashboard - Loading ${tabName} data failed:`, error.message);
      throw error;
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Load trends analytics data
   * @param {Object} filters - Active filters
   */
  async loadTrendsData(filters) {
    try {
      const cacheKey = `trends_${this.generateCacheKey(filters)}`;
      let data = this.getCachedData(cacheKey);

      if (!data) {
        // Show progress for potentially large datasets
        this.showProgressIndicator('Loading trends data...');
        
        const params = this.buildAPIParams(filters);
        
        // Add pagination and optimization parameters
        const urlParams = new URLSearchParams(params);
        urlParams.append('optimize', 'true');
        urlParams.append('limit', '1000'); // Reasonable limit for trends
        
        data = await this.makeAPICall(`${this.endpoints.trends}?${urlParams}`);
        
        // Handle large dataset warnings
        if (data.performance && data.performance.datasetSize) {
          this.handleDatasetSizeWarning(data.performance.datasetSize);
        }
        
        this.setCachedData(cacheKey, data);
        this.hideProgressIndicator();
      }

      if (data.success) {
        this.renderTrendsVisualization(data.data);
        this.updateTrendsSummary(data.data);
        this.updateDataQuality(data.dataQuality);
        
        // Show performance metrics if available
        if (data.performance) {
          this.updatePerformanceMetrics(data.performance);
        }
      } else {
        throw new Error(data.message || 'Failed to load trends data');
      }

    } catch (error) {
      this.hideProgressIndicator();
      console.error('[ERROR] AdminAnalyticsDashboard - loadTrendsData:', error.message);
      throw error;
    }
  }

  /**
   * Load geographic analytics data
   * @param {Object} filters - Active filters
   */
  async loadGeographicData(filters) {
    try {
      const cacheKey = `geographic_${this.generateCacheKey(filters)}`;
      let data = this.getCachedData(cacheKey);

      if (!data) {
        const params = this.buildAPIParams(filters);
        data = await this.makeAPICall(`${this.endpoints.geographic}?${params}`);
        this.setCachedData(cacheKey, data);
      }

      if (data.success) {
        this.renderGeographicVisualization(data.data);
        this.updateGeographicSummary(data.data);
        this.updateDataQuality(data.dataQuality);
      } else {
        throw new Error(data.message || 'Failed to load geographic data');
      }

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - loadGeographicData:', error.message);
      throw error;
    }
  }

  /**
   * Load drivers analytics data
   * @param {Object} filters - Active filters
   * @param {String} view - Current driver view
   */
  async loadDriversData(filters, view = null) {
    try {
      const driverPeriod = document.getElementById('driver-period')?.value || '30d';
      const driverView = view || document.getElementById('driver-view')?.value || 'overview';
      const cacheKey = `drivers_${this.generateCacheKey(filters)}_${driverPeriod}_${driverView}`;
      let data = this.getCachedData(cacheKey);

      if (!data) {
        const params = this.buildAPIParams(filters, { period: driverPeriod });
        data = await this.makeAPICall(`${this.endpoints.drivers}?${params}`);
        this.setCachedData(cacheKey, data);
      }

      if (data.success) {
        this.renderDriversVisualization(data.data, driverView);
        this.updateDriversSummary(data.data);
        this.updateDataQuality(data.dataQuality);
        
        // Load additional data for specific views
        if (driverView === 'ranking') {
          await this.loadDriverRankingData(filters);
        } else if (driverView === 'efficiency') {
          await this.loadDriverEfficiencyData(filters);
        }
      } else {
        throw new Error(data.message || 'Failed to load drivers data');
      }

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - loadDriversData:', error.message);
      throw error;
    }
  }

  /**
   * Load driver ranking data
   * @param {Object} filters - Active filters
   */
  async loadDriverRankingData(filters) {
    try {
      // For privacy, we'll use aggregated ranking data instead of individual driver data
      const driverPeriod = document.getElementById('driver-period')?.value || '30d';
      const params = this.buildAPIParams(filters, { period: driverPeriod, view: 'ranking' });
      
      const rankingData = await this.makeAPICall(`${this.endpoints.drivers}?${params}`);
      
      if (rankingData.success) {
        this.renderDriverRankingVisualization(rankingData.data);
        this.updateDriverRankingMetrics(rankingData.data);
      }
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - loadDriverRankingData:', error.message);
    }
  }

  /**
   * Load driver efficiency data
   * @param {Object} filters - Active filters
   */
  async loadDriverEfficiencyData(filters) {
    try {
      const driverPeriod = document.getElementById('driver-period')?.value || '30d';
      const params = this.buildAPIParams(filters, { period: driverPeriod, view: 'efficiency' });
      
      const efficiencyData = await this.makeAPICall(`${this.endpoints.drivers}?${params}`);
      
      if (efficiencyData.success) {
        this.renderDriverEfficiencyVisualization(efficiencyData.data);
        this.updateDriverEfficiencyInsights(efficiencyData.data);
      }
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - loadDriverEfficiencyData:', error.message);
    }
  }

  /**
   * Load status analytics data
   * @param {Object} filters - Active filters
   */
  async loadStatusData(filters) {
    try {
      const cacheKey = `status_${this.generateCacheKey(filters)}`;
      let data = this.getCachedData(cacheKey);

      if (!data) {
        const params = this.buildAPIParams(filters);
        data = await this.makeAPICall(`${this.endpoints.status}?${params}`);
        this.setCachedData(cacheKey, data);
      }

      if (data.success) {
        this.renderStatusVisualization(data.data);
        this.updateStatusSummary(data.data);
        this.updateDataQuality(data.dataQuality);
      } else {
        throw new Error(data.message || 'Failed to load status data');
      }

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - loadStatusData:', error.message);
      throw error;
    }
  }

  /**
   * Load workflow analytics data
   * @param {Object} filters - Active filters
   */
  async loadWorkflowData(filters) {
    try {
      const cacheKey = `workflow_${this.generateCacheKey(filters)}`;
      let cachedData = this.getCachedData(cacheKey);

      if (!cachedData) {
        const params = this.buildAPIParams(filters);
        
        // Load status transitions data
        const transitionsPromise = this.makeAPICall(`${this.endpoints.statusTransitions}?${params}`);
        
        // Load workflow timeline data
        const timelineParams = new URLSearchParams(params);
        timelineParams.append('groupBy', 'day');
        timelineParams.append('maxReports', '50');
        const timelinePromise = this.makeAPICall(`${this.endpoints.workflowTimeline}?${timelineParams}`);
        
        // Load bottlenecks data
        const bottlenecksPromise = this.makeAPICall(`${this.endpoints.workflowBottlenecks}?${params}`);

        // Wait for all data to load
        const [transitionsData, timelineData, bottlenecksData] = await Promise.all([
          transitionsPromise,
          timelinePromise,
          bottlenecksPromise
        ]);

        cachedData = {
          transitions: transitionsData.success ? transitionsData.data : null,
          timeline: timelineData.success ? timelineData.data : null,
          bottlenecks: bottlenecksData.success ? bottlenecksData.data : null
        };

        this.setCachedData(cacheKey, cachedData);
      }

      // Render workflow visualizations
      if (cachedData.transitions) {
        this.renderWorkflowTransitions(cachedData.transitions);
      }
      
      if (cachedData.timeline) {
        this.renderWorkflowTimeline(cachedData.timeline);
      }
      
      if (cachedData.bottlenecks) {
        this.renderWorkflowBottlenecks(cachedData.bottlenecks);
      }

      // Update workflow summary
      this.updateWorkflowSummary(cachedData);

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - loadWorkflowData:', error.message);
      throw error;
    }
  }

  // Visualization rendering methods

  /**
   * Render trends visualization
   * @param {Object} data - Trends data
   */
  renderTrendsVisualization(data) {
    try {
      this.visualization.renderTrendChart(data, 'trends-chart', {
        title: 'Incident Trends Over Time'
      });

      console.log('[INFO] AdminAnalyticsDashboard - Trends visualization rendered');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderTrendsVisualization:', error.message);
    }
  }

  /**
   * Render geographic visualization
   * @param {Object} data - Geographic data
   */
  renderGeographicVisualization(data) {
    try {
      if (data.coordinates && data.coordinates.length > 0) {
        this.visualization.renderHeatMap(data.coordinates, 'geographic-map');
      } else {
        this.visualization.renderIncidentMarkers([], 'geographic-map');
      }

      console.log('[INFO] AdminAnalyticsDashboard - Geographic visualization rendered');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderGeographicVisualization:', error.message);
    }
  }

  /**
   * Render drivers visualization
   * @param {Object} data - Drivers data
   * @param {String} view - Current view (overview/ranking/efficiency)
   */
  renderDriversVisualization(data, view = 'overview') {
    try {
      switch (view) {
        case 'overview':
          this.renderDriverOverviewVisualization(data);
          break;
        case 'ranking':
          this.renderDriverRankingVisualization(data);
          break;
        case 'efficiency':
          this.renderDriverEfficiencyVisualization(data);
          break;
        default:
          this.renderDriverOverviewVisualization(data);
      }

      console.log(`[INFO] AdminAnalyticsDashboard - Drivers visualization rendered (${view})`);
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderDriversVisualization:', error.message);
    }
  }

  /**
   * Render driver overview visualization
   * @param {Object} data - Drivers data
   */
  renderDriverOverviewVisualization(data) {
    try {
      // Main performance chart
      this.visualization.renderDriverPerformanceBar(data, 'drivers-chart', {
        title: 'Driver Performance Comparison (Privacy Protected)',
        horizontal: false
      });

      // Performance distribution chart
      if (data.performanceDistribution) {
        this.visualization.renderStatusPieChart(data.performanceDistribution, 'drivers-distribution-chart', {
          title: 'Performance Distribution'
        });
      }

      // Update ranking table
      this.updateDriverRankingTable(data);

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderDriverOverviewVisualization:', error.message);
    }
  }

  /**
   * Render driver ranking visualization
   * @param {Object} data - Drivers ranking data
   */
  renderDriverRankingVisualization(data) {
    try {
      // Radar chart for performance metrics
      this.visualization.renderDriverRankingChart(data, 'drivers-radar-chart', {
        title: 'Performance Metrics Comparison'
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderDriverRankingVisualization:', error.message);
    }
  }

  /**
   * Render driver efficiency visualization
   * @param {Object} data - Drivers efficiency data
   */
  renderDriverEfficiencyVisualization(data) {
    try {
      // Efficiency scatter plot
      this.visualization.renderDriverEfficiencyChart(data, 'drivers-efficiency-chart', {
        title: 'Driver Efficiency Matrix (Anonymized)'
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderDriverEfficiencyVisualization:', error.message);
    }
  }

  /**
   * Render status visualization
   * @param {Object} data - Status data
   */
  renderStatusVisualization(data) {
    try {
      this.visualization.renderStatusPieChart(data, 'status-pie-chart', {
        title: 'Status Distribution'
      });

      this.visualization.renderStatusBarChart(data, 'status-bar-chart', {
        title: 'Status Count Breakdown'
      });

      console.log('[INFO] AdminAnalyticsDashboard - Status visualization rendered');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderStatusVisualization:', error.message);
    }
  }

  /**
   * Render workflow transitions visualization
   * @param {Object} data - Status transitions data
   */
  renderWorkflowTransitions(data) {
    try {
      // Render status transition flow chart
      if (data.transitionAnalytics && data.transitionAnalytics.transitionStats) {
        this.visualization.renderTransitionFlowChart(
          data.transitionAnalytics.transitionStats, 
          'workflow-transitions-chart',
          { title: 'Status Transition Flow' }
        );
      }

      // Render common paths chart
      if (data.transitionAnalytics && data.transitionAnalytics.commonPaths) {
        this.visualization.renderCommonPathsChart(
          data.transitionAnalytics.commonPaths,
          'workflow-paths-chart',
          { title: 'Most Common Workflow Paths' }
        );
      }

      // Render status time analytics
      if (data.statusTimeAnalytics) {
        this.visualization.renderStatusTimeChart(
          data.statusTimeAnalytics,
          'status-time-chart',
          { title: 'Average Time in Each Status' }
        );
      }

      console.log('[INFO] AdminAnalyticsDashboard - Workflow transitions visualization rendered');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderWorkflowTransitions:', error.message);
    }
  }

  /**
   * Render workflow timeline visualization
   * @param {Object} data - Timeline data
   */
  renderWorkflowTimeline(data) {
    try {
      // Render aggregated timeline
      if (data.aggregatedTimeline) {
        this.visualization.renderTimelineChart(
          data.aggregatedTimeline,
          'workflow-timeline-chart',
          { title: 'Workflow Activity Timeline' }
        );
      }

      // Render efficiency metrics
      if (data.efficiencyMetrics) {
        this.visualization.renderEfficiencyMetrics(
          data.efficiencyMetrics,
          'workflow-efficiency-chart',
          { title: 'Workflow Efficiency Metrics' }
        );
      }

      console.log('[INFO] AdminAnalyticsDashboard - Workflow timeline visualization rendered');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderWorkflowTimeline:', error.message);
    }
  }

  /**
   * Render workflow bottlenecks visualization
   * @param {Object} data - Bottlenecks data
   */
  renderWorkflowBottlenecks(data) {
    try {
      // Render bottlenecks chart
      if (data.bottlenecks && data.bottlenecks.length > 0) {
        this.visualization.renderBottlenecksChart(
          data.bottlenecks,
          'workflow-bottlenecks-chart',
          { title: 'Workflow Bottlenecks Analysis' }
        );
      }

      // Update bottlenecks list
      this.updateBottlenecksList(data.bottlenecks);

      console.log('[INFO] AdminAnalyticsDashboard - Workflow bottlenecks visualization rendered');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - renderWorkflowBottlenecks:', error.message);
    }
  }

  // Summary update methods

  /**
   * Update trends summary cards
   * @param {Object} data - Trends data
   */
  updateTrendsSummary(data) {
    try {
      const elements = {
        'trends-total': data.totalIncidents || 0,
        'trends-recyclable': data.categoryTotals?.recyclable || 0,
        'trends-illegal': data.categoryTotals?.illegal_dumping || 0,
        'trends-hazardous': data.categoryTotals?.hazardous_waste || 0
      };

      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = this.formatNumber(value);
        }
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateTrendsSummary:', error.message);
    }
  }

  /**
   * Update geographic summary cards
   * @param {Object} data - Geographic data
   */
  updateGeographicSummary(data) {
    try {
      const elements = {
        'geo-locations': data.uniqueLocations || 0,
        'geo-geocoded': data.geocodedReports || 0,
        'geo-density': `${(data.averageDensity || 0).toFixed(2)}/km²`
      };

      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateGeographicSummary:', error.message);
    }
  }

  /**
   * Update drivers summary cards
   * @param {Object} data - Drivers data
   */
  updateDriversSummary(data) {
    try {
      const elements = {
        'drivers-avg-completion': `${(data.systemAverages?.completionRate || 0).toFixed(1)}%`,
        'drivers-avg-time': `${(data.systemAverages?.resolutionTime || 0).toFixed(1)}h`,
        'drivers-count': data.activeDrivers || 0,
        'drivers-efficiency': `${(data.systemAverages?.efficiencyScore || 0).toFixed(1)}%`
      };

      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      });

      // Update trend indicators
      this.updateDriverTrends(data);

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateDriversSummary:', error.message);
    }
  }

  /**
   * Update driver trend indicators
   * @param {Object} data - Drivers data
   */
  updateDriverTrends(data) {
    try {
      const trends = data.trends || {};
      
      const trendElements = {
        'drivers-completion-trend': this.formatTrend(trends.completionRate),
        'drivers-time-trend': this.formatTrend(trends.resolutionTime, true), // Inverted for time (lower is better)
        'drivers-activity-trend': this.formatTrend(trends.activeDrivers),
        'drivers-efficiency-trend': this.formatTrend(trends.efficiencyScore)
      };

      Object.entries(trendElements).forEach(([id, trendText]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = trendText;
        }
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateDriverTrends:', error.message);
    }
  }

  /**
   * Update driver ranking table
   * @param {Object} data - Drivers data
   */
  updateDriverRankingTable(data) {
    try {
      const tableBody = document.getElementById('drivers-ranking-table');
      if (!tableBody || !data.drivers) return;

      // Clear existing content
      tableBody.innerHTML = '';

      // Sort drivers by performance score and take top 10
      const topDrivers = data.drivers
        .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0))
        .slice(0, 10);

      topDrivers.forEach((driver, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        
        // Privacy-compliant driver identifier
        const driverLabel = `Driver ${String.fromCharCode(65 + index)}`;
        
        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            ${index + 1}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${driverLabel}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <div class="flex items-center">
              <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                <div class="bg-green-600 h-2 rounded-full" style="width: ${driver.completionRate || 0}%"></div>
              </div>
              ${(driver.completionRate || 0).toFixed(1)}%
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${(driver.averageResolutionTime || 0).toFixed(1)}h
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <div class="flex items-center">
              <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                <div class="bg-blue-600 h-2 rounded-full" style="width: ${driver.efficiencyScore || 0}%"></div>
              </div>
              ${(driver.efficiencyScore || 0).toFixed(1)}%
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatTrend(driver.performanceTrend)}
          </td>
        `;
        
        tableBody.appendChild(row);
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateDriverRankingTable:', error.message);
    }
  }

  /**
   * Update driver ranking metrics
   * @param {Object} data - Driver ranking data
   */
  updateDriverRankingMetrics(data) {
    try {
      if (!data.systemAverages) return;

      const metrics = {
        'completion-rate': data.systemAverages.completionRate || 0,
        'resolution-speed': data.systemAverages.resolutionSpeedScore || 0,
        'quality-score': data.systemAverages.qualityScore || 0,
        'consistency': data.systemAverages.consistencyScore || 0
      };

      Object.entries(metrics).forEach(([metric, value]) => {
        const barElement = document.getElementById(`${metric}-bar`);
        const valueElement = document.getElementById(`${metric}-value`);
        
        if (barElement) {
          barElement.style.width = `${value}%`;
        }
        
        if (valueElement) {
          valueElement.textContent = `${value.toFixed(1)}%`;
        }
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateDriverRankingMetrics:', error.message);
    }
  }

  /**
   * Update driver efficiency insights
   * @param {Object} data - Driver efficiency data
   */
  updateDriverEfficiencyInsights(data) {
    try {
      if (!data.efficiencyInsights) return;

      const insights = data.efficiencyInsights;
      
      const insightElements = {
        'high-performers-count': `${insights.highPerformers || 0} drivers`,
        'developing-performers-count': `${insights.developing || 0} drivers`,
        'specialist-performers-count': `${insights.specialists || 0} drivers`,
        'support-needed-count': `${insights.needsSupport || 0} drivers`
      };

      Object.entries(insightElements).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = text;
        }
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateDriverEfficiencyInsights:', error.message);
    }
  }

  /**
   * Format trend value for display
   * @param {Number} trend - Trend value
   * @param {Boolean} inverted - Whether lower values are better
   * @returns {String} Formatted trend text
   */
  formatTrend(trend, inverted = false) {
    if (typeof trend !== 'number') return 'No data';
    
    const absValue = Math.abs(trend);
    const isPositive = inverted ? trend < 0 : trend > 0;
    const arrow = isPositive ? '↗' : '↘';
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    
    if (absValue < 0.1) return 'Stable';
    
    return `<span class="${color}">${arrow} ${absValue.toFixed(1)}%</span>`;
  }

  /**
   * Update status summary cards
   * @param {Object} data - Status data
   */
  updateStatusSummary(data) {
    try {
      const completionRate = data.completionRate || 0;
      const rejectionRate = data.rejectionRate || 0;
      const inProgressCount = data.statusCounts?.['In Progress'] || 0;
      const avgResolutionTime = data.averageResolutionTime || 0;

      const elements = {
        'status-completion': `${completionRate.toFixed(1)}%`,
        'status-rejection': `${rejectionRate.toFixed(1)}%`,
        'status-progress': inProgressCount,
        'status-avg-time': `${avgResolutionTime.toFixed(1)}h`
      };

      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateStatusSummary:', error.message);
    }
  }

  /**
   * Update workflow summary cards
   * @param {Object} data - Workflow data
   */
  updateWorkflowSummary(data) {
    try {
      // Update workflow efficiency metrics
      if (data.timeline && data.timeline.efficiencyMetrics) {
        const efficiency = data.timeline.efficiencyMetrics;
        
        const elements = {
          'workflow-efficiency': `${efficiency.efficiencyScore || 0}%`,
          'workflow-avg-duration': `${(efficiency.averageWorkflowDuration || 0).toFixed(1)}h`,
          'workflow-completion': `${efficiency.completionRate || 0}%`,
          'workflow-total': efficiency.totalWorkflows || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = value;
          }
        });
      }

      // Update transition summary
      if (data.transitions && data.transitions.transitionAnalytics) {
        const transitions = data.transitions.transitionAnalytics;
        
        const transitionElements = {
          'workflow-transitions': transitions.totalTransitions || 0,
          'workflow-paths': transitions.commonPaths?.length || 0
        };

        Object.entries(transitionElements).forEach(([id, value]) => {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = value;
          }
        });
      }

      // Update bottlenecks summary
      if (data.bottlenecks && data.bottlenecks.summary) {
        const bottlenecks = data.bottlenecks.summary;
        
        const bottleneckElements = {
          'workflow-bottlenecks': bottlenecks.totalBottlenecks || 0,
          'workflow-high-severity': bottlenecks.highSeverity || 0
        };

        Object.entries(bottleneckElements).forEach(([id, value]) => {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = value;
          }
        });
      }

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateWorkflowSummary:', error.message);
    }
  }

  /**
   * Update bottlenecks list display
   * @param {Array} bottlenecks - Array of bottleneck data
   */
  updateBottlenecksList(bottlenecks) {
    try {
      const container = document.getElementById('workflow-bottlenecks-list');
      if (!container) return;

      if (!bottlenecks || bottlenecks.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-4">No bottlenecks detected</div>';
        return;
      }

      const bottleneckHTML = bottlenecks.map(bottleneck => {
        const severityClass = bottleneck.severity >= 70 ? 'bg-red-100 text-red-800' :
                             bottleneck.severity >= 40 ? 'bg-yellow-100 text-yellow-800' :
                             'bg-green-100 text-green-800';

        const recommendationsHTML = bottleneck.recommendations
          .map(rec => `<li class="text-sm text-gray-600">• ${rec}</li>`)
          .join('');

        return `
          <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-gray-900">${bottleneck.status} Status</h4>
              <span class="px-2 py-1 rounded-full text-xs font-medium ${severityClass}">
                Severity: ${bottleneck.severity}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-3">
              <div>
                <span class="text-sm text-gray-500">Average Duration:</span>
                <span class="font-medium ml-2">${bottleneck.metrics.averageDuration.toFixed(1)}h</span>
              </div>
              <div>
                <span class="text-sm text-gray-500">90th Percentile:</span>
                <span class="font-medium ml-2">${bottleneck.metrics.percentile90.toFixed(1)}h</span>
              </div>
            </div>
            <div class="mb-2">
              <span class="text-sm text-gray-500">Recommendations:</span>
              <ul class="mt-1">
                ${recommendationsHTML}
              </ul>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = bottleneckHTML;

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updateBottlenecksList:', error.message);
    }
  }

  // Event handlers

  /**
   * Handle filter changes
   * @param {Object} filters - Updated filters
   */
  handleFilterChange(filters) {
    console.log('[INFO] AdminAnalyticsDashboard - Filters changed:', filters);
    // Filters changed but not applied yet - could show preview or validation
  }

  /**
   * Handle filter application
   * @param {Object} filters - Applied filters
   */
  async handleFilterApply(filters) {
    try {
      console.log('[INFO] AdminAnalyticsDashboard - Applying filters:', filters);
      
      // Clear cache to force fresh data
      this.clearCache();
      
      // Reload current tab data
      await this.loadTabData(this.currentTab);
      
      // Update last updated timestamp
      this.updateLastUpdatedTimestamp();
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleFilterApply:', error.message);
      this.showError('Failed to apply filters');
    }
  }

  /**
   * Handle filter clearing
   */
  async handleFilterClear() {
    try {
      console.log('[INFO] AdminAnalyticsDashboard - Clearing filters');
      
      // Clear cache
      this.clearCache();
      
      // Reload current tab data
      await this.loadTabData(this.currentTab);
      
      // Update timestamp
      this.updateLastUpdatedTimestamp();
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleFilterClear:', error.message);
      this.showError('Failed to clear filters');
    }
  }

  /**
   * Handle data refresh
   */
  async refreshData() {
    try {
      console.log('[INFO] AdminAnalyticsDashboard - Refreshing data');
      
      // Clear cache to force fresh data
      this.clearCache();
      
      // Reload current tab data
      await this.loadTabData(this.currentTab);
      
      // Update timestamp
      this.updateLastUpdatedTimestamp();
      
      this.showSuccess('Data refreshed successfully');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - refreshData:', error.message);
      this.showError('Failed to refresh data');
    }
  }

  /**
   * Handle driver view change
   * @param {String} view - Selected view (overview/ranking/efficiency)
   */
  async handleDriverViewChange(view) {
    try {
      console.log(`[INFO] AdminAnalyticsDashboard - Driver view changed to: ${view}`);
      
      // Update view sections visibility
      this.updateDriverViewSections(view);
      
      if (this.currentTab === 'drivers') {
        // Reload drivers data with new view
        await this.loadDriversData(this.filters.getActiveFilters(), view);
      }
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleDriverViewChange:', error.message);
      this.showError('Failed to update driver view');
    }
  }

  /**
   * Handle driver period change
   * @param {String} period - Selected period
   */
  async handleDriverPeriodChange(period) {
    try {
      if (this.currentTab === 'drivers') {
        console.log(`[INFO] AdminAnalyticsDashboard - Driver period changed to: ${period}`);
        
        // Clear drivers cache
        this.clearCacheByPattern('drivers_');
        
        // Get current view
        const currentView = document.getElementById('driver-view')?.value || 'overview';
        
        // Reload drivers data
        await this.loadDriversData(this.filters.getActiveFilters(), currentView);
      }
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleDriverPeriodChange:', error.message);
      this.showError('Failed to update driver period');
    }
  }

  /**
   * Update driver view sections visibility
   * @param {String} activeView - Active view name
   */
  updateDriverViewSections(activeView) {
    const sections = {
      'overview': 'driver-overview-section',
      'ranking': 'driver-ranking-section',
      'efficiency': 'driver-efficiency-section'
    };

    Object.entries(sections).forEach(([view, sectionId]) => {
      const section = document.getElementById(sectionId);
      if (section) {
        if (view === activeView) {
          section.classList.remove('hidden');
        } else {
          section.classList.add('hidden');
        }
      }
    });
  }

  /**
   * Handle data export
   * @param {String} section - Section to export
   * @param {String} type - Export type (csv/pdf)
   */
  async handleExport(section, type) {
    try {
      console.log(`[INFO] AdminAnalyticsDashboard - Exporting ${section} as ${type}`);
      
      const activeFilters = this.filters.getActiveFilters();
      const params = this.buildAPIParams(activeFilters, { section, format: type });
      
      // Show loading state
      this.showExportLoading(section, type, true);
      
      const endpoint = type === 'csv' ? this.endpoints.exportCSV : this.endpoints.exportPDF;
      const response = await this.makeAPICall(`${endpoint}?${params}`, {
        method: 'POST',
        responseType: 'blob'
      });

      if (response) {
        this.downloadFile(response, `analytics_${section}_${new Date().toISOString().split('T')[0]}.${type}`);
        this.showSuccess(`${section} data exported successfully`);
      }
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleExport:', error.message);
      this.showError(`Failed to export ${section} data`);
    } finally {
      this.showExportLoading(section, type, false);
    }
  }

  /**
   * Handle logout
   */
  handleLogout() {
    try {
      // Clear authentication
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear cache
      this.clearCache();
      
      // Stop auto-refresh
      this.stopAutoRefresh();
      
      // Redirect to login
      window.location.href = 'login.html';
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleLogout:', error.message);
    }
  }

  /**
   * Handle authentication failure
   */
  handleAuthenticationFailure() {
    this.showError('Authentication failed. Please log in again.');
    setTimeout(() => {
      this.handleLogout();
    }, 2000);
  }

  /**
   * Handle window focus (check for updates)
   */
  async handleWindowFocus() {
    try {
      // Check if data is stale when window regains focus
      if (this.lastUpdated) {
        const timeSinceUpdate = Date.now() - this.lastUpdated;
        if (timeSinceUpdate > this.refreshIntervalMs) {
          console.log('[INFO] AdminAnalyticsDashboard - Data is stale, refreshing...');
          await this.refreshData();
        }
      }
      
      // Perform connection health check
      await this.performHealthCheck();
      
    } catch (error) {
      console.warn('[WARN] AdminAnalyticsDashboard - Window focus health check failed:', error.message);
    }
  }

  /**
   * Perform connection health check
   */
  async performHealthCheck() {
    try {
      const healthResponse = await this.makeAPICall(this.endpoints.health, {
        method: 'GET',
        timeout: 5000 // 5 second timeout for health checks
      });
      
      if (healthResponse.success) {
        // Clear any existing connection warnings
        this.clearConnectionWarnings();
        
        // Update system health status
        await this.checkSystemHealth(healthResponse);
      }
      
    } catch (error) {
      console.warn('[WARN] AdminAnalyticsDashboard - Health check failed:', error.message);
      
      // Show connection warning if health check fails
      if (error.message.includes('Network connection failed') || 
          error.message.includes('Database connection failed')) {
        this.showConnectionWarning();
      }
    }
  }

  /**
   * Show connection warning
   */
  showConnectionWarning() {
    let warningElement = document.getElementById('connection-warning');
    
    if (!warningElement) {
      warningElement = document.createElement('div');
      warningElement.id = 'connection-warning';
      warningElement.className = 'fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-md p-4 z-50 max-w-sm';
      warningElement.innerHTML = `
        <div class="flex">
          <div class="flex-shrink-0">
            <span class="material-symbols-outlined text-red-400">wifi_off</span>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Connection Issues</h3>
            <div class="mt-2 text-sm text-red-700">
              <p>Unable to connect to analytics server. Retrying automatically...</p>
            </div>
            <div class="mt-3 flex space-x-2">
              <button id="retry-connection" class="text-sm font-medium text-red-800 hover:text-red-900 underline">
                Retry Now
              </button>
              <button id="dismiss-connection-warning" class="text-sm font-medium text-red-600 hover:text-red-700">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(warningElement);
      
      // Add event listeners
      const retryButton = warningElement.querySelector('#retry-connection');
      if (retryButton) {
        retryButton.addEventListener('click', async () => {
          await this.performHealthCheck();
          if (document.getElementById('connection-warning')) {
            await this.refreshData();
          }
        });
      }
      
      const dismissButton = warningElement.querySelector('#dismiss-connection-warning');
      if (dismissButton) {
        dismissButton.addEventListener('click', () => {
          warningElement.remove();
        });
      }
      
      // Auto-retry connection every 30 seconds
      this.startConnectionRetry();
    }
  }

  /**
   * Clear connection warnings
   */
  clearConnectionWarnings() {
    const warningElement = document.getElementById('connection-warning');
    if (warningElement) {
      warningElement.remove();
    }
    
    // Stop connection retry if it's running
    this.stopConnectionRetry();
  }

  /**
   * Start automatic connection retry
   */
  startConnectionRetry() {
    this.stopConnectionRetry(); // Clear any existing retry
    
    this.connectionRetryInterval = setInterval(async () => {
      console.log('[INFO] AdminAnalyticsDashboard - Auto-retrying connection...');
      await this.performHealthCheck();
    }, 30000); // Retry every 30 seconds
  }

  /**
   * Stop automatic connection retry
   */
  stopConnectionRetry() {
    if (this.connectionRetryInterval) {
      clearInterval(this.connectionRetryInterval);
      this.connectionRetryInterval = null;
    }
  }

  // Auto-refresh functionality

  /**
   * Start automatic data refresh
   */
  startAutoRefresh() {
    this.stopAutoRefresh(); // Clear any existing interval
    
    this.refreshInterval = setInterval(() => {
      console.log('[INFO] AdminAnalyticsDashboard - Auto-refreshing data');
      this.refreshData();
    }, this.refreshIntervalMs);
    
    console.log(`[INFO] AdminAnalyticsDashboard - Auto-refresh started (${this.refreshIntervalMs / 1000}s interval)`);
  }

  /**
   * Stop automatic data refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('[INFO] AdminAnalyticsDashboard - Auto-refresh stopped');
    }
  }

  // API and caching utilities

  /**
   * Make API call with error handling and retries
   * @param {String} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Object} API response
   */
  async makeAPICall(url, options = {}) {
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    };

    const finalOptions = { ...defaultOptions, ...options };
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[INFO] AdminAnalyticsDashboard - API call attempt ${attempt}: ${url}`);
        
        // Show retry indicator for attempts > 1
        if (attempt > 1) {
          this.showRetryIndicator(attempt, this.retryAttempts);
        }
        
        const response = await fetch(url, finalOptions);
        
        // Hide retry indicator on success
        if (attempt > 1) {
          this.hideRetryIndicator();
        }
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication failed - please log in again');
          }
          if (response.status === 503) {
            throw new Error('Database connection failed - service temporarily unavailable');
          }
          if (response.status === 500) {
            throw new Error('Internal server error - please try again later');
          }
          if (response.status === 404) {
            throw new Error('Analytics endpoint not found');
          }
          if (response.status >= 500) {
            throw new Error(`Server error (${response.status}) - database may be unavailable`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (options.responseType === 'blob') {
          return await response.blob();
        }

        const data = await response.json();
        console.log(`[INFO] AdminAnalyticsDashboard - API call successful: ${url}`);
        
        // Validate response structure
        if (!this.validateAPIResponse(data)) {
          throw new Error('Invalid response format from server');
        }
        
        return data;
        
      } catch (error) {
        lastError = error;
        console.error(`[ERROR] AdminAnalyticsDashboard - API call attempt ${attempt} failed:`, error.message);
        
        // Check if this is a network error (database connection issue)
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          lastError = new Error('Network connection failed - unable to reach analytics server');
        }
        
        if (attempt === this.retryAttempts) {
          // Hide retry indicator on final failure
          this.hideRetryIndicator();
          
          // Show specific error message based on error type
          this.handleAPIError(lastError, url);
          throw lastError;
        }
        
        // Calculate exponential backoff delay
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`[INFO] AdminAnalyticsDashboard - Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Validate API response structure
   * @param {Object} data - Response data
   * @returns {Boolean} Whether response is valid
   */
  validateAPIResponse(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Check for required fields
    if (!data.hasOwnProperty('success')) {
      return false;
    }
    
    // If successful, should have data field
    if (data.success && !data.hasOwnProperty('data')) {
      return false;
    }
    
    // If failed, should have message field
    if (!data.success && !data.hasOwnProperty('message')) {
      return false;
    }
    
    return true;
  }

  /**
   * Handle API errors with specific messaging
   * @param {Error} error - The error that occurred
   * @param {String} url - The URL that failed
   */
  handleAPIError(error, url) {
    let userMessage = 'An error occurred while loading analytics data.';
    let showRetryButton = false;
    
    if (error.message.includes('Database connection failed') || 
        error.message.includes('database may be unavailable') ||
        error.message.includes('Network connection failed')) {
      userMessage = 'Database connection failed. The analytics service is temporarily unavailable.';
      showRetryButton = true;
    } else if (error.message.includes('Authentication failed')) {
      userMessage = 'Your session has expired. Please log in again.';
      // Auto-redirect to login after showing message
      setTimeout(() => this.handleLogout(), 3000);
    } else if (error.message.includes('Internal server error')) {
      userMessage = 'The server encountered an error. Please try again in a few moments.';
      showRetryButton = true;
    } else if (error.message.includes('service temporarily unavailable')) {
      userMessage = 'The analytics service is temporarily unavailable. Please try again later.';
      showRetryButton = true;
    }
    
    this.showError(userMessage, showRetryButton);
  }

  /**
   * Show retry indicator
   * @param {Number} attempt - Current attempt number
   * @param {Number} maxAttempts - Maximum attempts
   */
  showRetryIndicator(attempt, maxAttempts) {
    const retryIndicator = document.getElementById('retry-indicator');
    if (!retryIndicator) {
      // Create retry indicator if it doesn't exist
      const indicator = document.createElement('div');
      indicator.id = 'retry-indicator';
      indicator.className = 'fixed top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-md p-4 z-50';
      indicator.innerHTML = `
        <div class="flex">
          <div class="flex-shrink-0">
            <span class="material-symbols-outlined text-yellow-400 animate-spin">refresh</span>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-800">Retrying Connection</h3>
            <div class="mt-2 text-sm text-yellow-700">
              <p id="retry-text">Attempting to reconnect...</p>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(indicator);
    }
    
    const retryText = document.getElementById('retry-text');
    if (retryText) {
      retryText.textContent = `Retry attempt ${attempt} of ${maxAttempts}...`;
    }
  }

  /**
   * Hide retry indicator
   */
  hideRetryIndicator() {
    const retryIndicator = document.getElementById('retry-indicator');
    if (retryIndicator && retryIndicator.parentNode) {
      retryIndicator.parentNode.removeChild(retryIndicator);
    }
  }

  /**
   * Build API parameters from filters
   * @param {Object} filters - Active filters
   * @param {Object} additional - Additional parameters
   * @returns {String} URL parameters string
   */
  buildAPIParams(filters, additional = {}) {
    const params = new URLSearchParams();
    
    // Date range
    if (filters.dateRange.startDate) {
      params.append('startDate', filters.dateRange.startDate.toISOString().split('T')[0]);
    }
    if (filters.dateRange.endDate) {
      params.append('endDate', filters.dateRange.endDate.toISOString().split('T')[0]);
    }
    
    // Category filter
    if (filters.category && filters.category !== 'all') {
      params.append('category', filters.category);
    }
    
    // Status filter
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    
    // Additional parameters
    Object.entries(additional).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });
    
    return params.toString();
  }

  /**
   * Generate cache key from filters
   * @param {Object} filters - Active filters
   * @returns {String} Cache key
   */
  generateCacheKey(filters) {
    const keyParts = [
      filters.dateRange.startDate ? filters.dateRange.startDate.toISOString().split('T')[0] : 'no-start',
      filters.dateRange.endDate ? filters.dateRange.endDate.toISOString().split('T')[0] : 'no-end',
      filters.category || 'all',
      filters.status || 'all'
    ];
    
    return keyParts.join('_');
  }

  /**
   * Get cached data
   * @param {String} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  getCachedData(key) {
    const cached = this.dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`[INFO] AdminAnalyticsDashboard - Cache hit: ${key}`);
      return cached.data;
    }
    
    if (cached) {
      this.dataCache.delete(key);
      console.log(`[INFO] AdminAnalyticsDashboard - Cache expired: ${key}`);
    }
    
    return null;
  }

  /**
   * Set cached data
   * @param {String} key - Cache key
   * @param {Object} data - Data to cache
   */
  setCachedData(key, data) {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`[INFO] AdminAnalyticsDashboard - Data cached: ${key}`);
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.dataCache.clear();
    console.log('[INFO] AdminAnalyticsDashboard - Cache cleared');
  }

  /**
   * Clear cached data by pattern
   * @param {String} pattern - Pattern to match keys
   */
  clearCacheByPattern(pattern) {
    const keysToDelete = [];
    this.dataCache.forEach((value, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.dataCache.delete(key));
    console.log(`[INFO] AdminAnalyticsDashboard - Cache cleared for pattern: ${pattern}`);
  }

  // UI utility methods

  /**
   * Show/hide loading indicator
   * @param {Boolean} show - Whether to show loading
   */
  showLoading(show) {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      if (show) {
        loadingIndicator.classList.remove('hidden');
        this.isLoading = true;
      } else {
        loadingIndicator.classList.add('hidden');
        this.isLoading = false;
      }
    }
  }

  /**
   * Show progress indicator with message
   * @param {String} message - Progress message
   */
  showProgressIndicator(message = 'Loading...') {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
      const messageElement = indicator.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message;
      }
      indicator.classList.remove('hidden');
      this.isLoading = true;
    }
  }

  /**
   * Hide progress indicator
   */
  hideProgressIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
      indicator.classList.add('hidden');
      this.isLoading = false;
    }
  }

  /**
   * Handle dataset size warnings and optimization suggestions
   * @param {Object} datasetSize - Dataset size information
   */
  handleDatasetSizeWarning(datasetSize) {
    try {
      const { totalDocuments, processingComplexity, recommendedPageSize } = datasetSize;
      
      if (totalDocuments > 50000) {
        this.showDatasetWarning(
          'Large Dataset Detected',
          `Processing ${totalDocuments.toLocaleString()} records. Consider applying additional filters for better performance.`,
          'warning'
        );
      } else if (processingComplexity === 'high') {
        this.showDatasetWarning(
          'Complex Processing',
          'This query involves complex data processing. Results may take longer to load.',
          'info'
        );
      }

      // Update recommended settings
      if (recommendedPageSize < 100) {
        console.log(`[INFO] AdminAnalyticsDashboard - Recommended page size: ${recommendedPageSize}`);
      }

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - handleDatasetSizeWarning:', error.message);
    }
  }

  /**
   * Show dataset warning notification
   * @param {String} title - Warning title
   * @param {String} message - Warning message
   * @param {String} type - Warning type (warning, info, error)
   */
  showDatasetWarning(title, message, type = 'warning') {
    try {
      // Create warning notification
      const warningDiv = document.createElement('div');
      warningDiv.className = `fixed top-4 right-4 max-w-sm p-4 rounded-lg shadow-lg z-50 ${
        type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
        type === 'error' ? 'bg-red-50 border border-red-200' :
        'bg-blue-50 border border-blue-200'
      }`;

      const iconColor = type === 'warning' ? 'text-yellow-600' :
                       type === 'error' ? 'text-red-600' :
                       'text-blue-600';

      const textColor = type === 'warning' ? 'text-yellow-800' :
                       type === 'error' ? 'text-red-800' :
                       'text-blue-800';

      warningDiv.innerHTML = `
        <div class="flex">
          <div class="flex-shrink-0">
            <span class="material-symbols-outlined ${iconColor}">
              ${type === 'warning' ? 'warning' : type === 'error' ? 'error' : 'info'}
            </span>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium ${textColor}">${title}</h3>
            <p class="mt-1 text-sm ${textColor}">${message}</p>
          </div>
          <div class="ml-auto pl-3">
            <button class="inline-flex ${textColor} hover:${textColor.replace('800', '900')}" onclick="this.parentElement.parentElement.parentElement.remove()">
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(warningDiv);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (warningDiv.parentElement) {
          warningDiv.remove();
        }
      }, 10000);

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - showDatasetWarning:', error.message);
    }
  }

  /**
   * Update performance metrics display
   * @param {Object} performance - Performance metrics
   */
  updatePerformanceMetrics(performance) {
    try {
      const { datasetSize, processingTime, optimizationApplied } = performance;
      
      // Update performance indicators in the UI
      const perfElement = document.getElementById('performance-metrics');
      if (perfElement) {
        perfElement.innerHTML = `
          <div class="text-xs text-gray-500 space-y-1">
            <div>Dataset: ${datasetSize.totalDocuments?.toLocaleString() || 'Unknown'} records</div>
            <div>Complexity: ${datasetSize.processingComplexity || 'Unknown'}</div>
            ${optimizationApplied ? '<div class="text-green-600">✓ Optimized</div>' : ''}
          </div>
        `;
      }

      // Log performance metrics
      console.log('[INFO] AdminAnalyticsDashboard - Performance metrics:', {
        documents: datasetSize.totalDocuments,
        complexity: datasetSize.processingComplexity,
        optimized: optimizationApplied
      });

    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - updatePerformanceMetrics:', error.message);
    }
  }

  /**
   * Show export loading state
   * @param {String} section - Section being exported
   * @param {String} type - Export type
   * @param {Boolean} loading - Loading state
   */
  showExportLoading(section, type, loading) {
    const buttonId = `export-${section}-${type}`;
    const button = document.getElementById(buttonId);
    
    if (button) {
      if (loading) {
        button.disabled = true;
        button.innerHTML = `
          <span class="material-symbols-outlined mr-1 animate-spin">refresh</span>
          Exporting...
        `;
      } else {
        button.disabled = false;
        const icon = type === 'csv' ? 'download' : 'picture_as_pdf';
        button.innerHTML = `
          <span class="material-symbols-outlined mr-1">${icon}</span>
          ${type.toUpperCase()}
        `;
      }
    }
  }

  /**
   * Show error message
   * @param {String} message - Error message
   * @param {Boolean} showRetryButton - Whether to show retry button
   */
  showError(message, showRetryButton = false) {
    const errorElement = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    if (errorElement && errorText) {
      errorText.textContent = message;
      
      // Add retry button if requested
      if (showRetryButton) {
        const existingButton = errorElement.querySelector('.retry-button');
        if (!existingButton) {
          const retryButton = document.createElement('button');
          retryButton.className = 'retry-button mt-3 inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500';
          retryButton.innerHTML = `
            <span class="material-symbols-outlined mr-1">refresh</span>
            Retry Connection
          `;
          retryButton.addEventListener('click', () => {
            this.hideError();
            this.refreshData();
          });
          
          const textContainer = errorText.parentNode;
          textContainer.appendChild(retryButton);
        }
      } else {
        // Remove retry button if it exists
        const existingButton = errorElement.querySelector('.retry-button');
        if (existingButton) {
          existingButton.remove();
        }
      }
      
      errorElement.classList.remove('hidden');
      
      // Auto-hide after 10 seconds for non-critical errors (without retry button)
      if (!showRetryButton) {
        setTimeout(() => {
          errorElement.classList.add('hidden');
        }, 10000);
      }
    }
    
    console.error('[ERROR] AdminAnalyticsDashboard:', message);
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.classList.add('hidden');
      
      // Clean up retry button
      const retryButton = errorElement.querySelector('.retry-button');
      if (retryButton) {
        retryButton.remove();
      }
    }
  }

  /**
   * Show success message
   * @param {String} message - Success message
   */
  showSuccess(message) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 rounded-md p-4 z-50';
    notification.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          <span class="material-symbols-outlined text-green-400">check_circle</span>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-green-800">${message}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
    
    console.log('[SUCCESS] AdminAnalyticsDashboard:', message);
  }

  /**
   * Update data quality indicator
   * @param {Object} dataQuality - Data quality information
   */
  updateDataQuality(dataQuality) {
    if (dataQuality) {
      this.dataQuality = { ...this.dataQuality, ...dataQuality };
      
      const qualityElement = document.getElementById('data-quality');
      const qualityText = document.getElementById('data-quality-text');
      const qualityScore = document.getElementById('data-quality-score');
      
      if (qualityElement && qualityText && qualityScore) {
        const score = this.dataQuality.qualityScore || 0;
        const validRecords = this.dataQuality.validRecords || 0;
        const excludedRecords = this.dataQuality.excludedRecords || 0;
        const totalRecords = validRecords + excludedRecords;
        
        // Update score display
        qualityScore.textContent = score.toFixed(1);
        
        // Create detailed quality message
        let qualityMessage = '';
        if (totalRecords === 0) {
          qualityMessage = 'No data available for the selected filters.';
        } else if (excludedRecords === 0) {
          qualityMessage = `All ${validRecords} records processed successfully. Data quality is excellent.`;
        } else {
          qualityMessage = `${validRecords} of ${totalRecords} records processed (${excludedRecords} excluded due to data quality issues).`;
          
          // Add details about exclusion reasons if available
          if (this.dataQuality.exclusionReasons) {
            const reasons = this.dataQuality.exclusionReasons;
            const reasonDetails = [];
            
            if (reasons.invalidDates > 0) {
              reasonDetails.push(`${reasons.invalidDates} invalid dates`);
            }
            if (reasons.invalidCoordinates > 0) {
              reasonDetails.push(`${reasons.invalidCoordinates} invalid coordinates`);
            }
            if (reasons.missingData > 0) {
              reasonDetails.push(`${reasons.missingData} missing required fields`);
            }
            if (reasons.duplicates > 0) {
              reasonDetails.push(`${reasons.duplicates} duplicate records`);
            }
            
            if (reasonDetails.length > 0) {
              qualityMessage += ` Exclusions: ${reasonDetails.join(', ')}.`;
            }
          }
        }
        
        qualityText.textContent = qualityMessage;
        
        // Show/hide quality indicator based on data quality
        if (excludedRecords > 0 || totalRecords === 0) {
          qualityElement.classList.remove('hidden');
          
          // Change color based on quality score
          const qualityContainer = qualityElement.querySelector('.flex');
          if (qualityContainer) {
            // Remove existing color classes
            qualityElement.className = qualityElement.className.replace(/bg-(red|yellow|blue)-50/g, '');
            qualityElement.className = qualityElement.className.replace(/border-(red|yellow|blue)-200/g, '');
            
            const iconElement = qualityElement.querySelector('.material-symbols-outlined');
            if (iconElement) {
              iconElement.className = iconElement.className.replace(/text-(red|yellow|blue)-400/g, '');
            }
            
            const titleElement = qualityElement.querySelector('h3');
            if (titleElement) {
              titleElement.className = titleElement.className.replace(/text-(red|yellow|blue)-800/g, '');
            }
            
            const textElement = qualityElement.querySelector('#data-quality-text');
            if (textElement) {
              textElement.className = textElement.className.replace(/text-(red|yellow|blue)-700/g, '');
            }
            
            // Apply appropriate color based on quality score
            if (score < 70) {
              // Poor quality - red
              qualityElement.classList.add('bg-red-50', 'border-red-200');
              if (iconElement) iconElement.classList.add('text-red-400');
              if (titleElement) titleElement.classList.add('text-red-800');
              if (textElement) textElement.classList.add('text-red-700');
              if (titleElement) titleElement.textContent = 'Data Quality Warning';
            } else if (score < 90) {
              // Moderate quality - yellow
              qualityElement.classList.add('bg-yellow-50', 'border-yellow-200');
              if (iconElement) iconElement.classList.add('text-yellow-400');
              if (titleElement) titleElement.classList.add('text-yellow-800');
              if (textElement) textElement.classList.add('text-yellow-700');
              if (titleElement) titleElement.textContent = 'Data Quality Notice';
            } else {
              // Good quality - blue (info)
              qualityElement.classList.add('bg-blue-50', 'border-blue-200');
              if (iconElement) iconElement.classList.add('text-blue-400');
              if (titleElement) titleElement.classList.add('text-blue-800');
              if (textElement) textElement.classList.add('text-blue-700');
              if (titleElement) titleElement.textContent = 'Data Quality';
            }
          }
        } else {
          qualityElement.classList.add('hidden');
        }
        
        // Update processing statistics
        this.updateProcessingStats(totalRecords, validRecords, excludedRecords);
      }
    }
  }

  /**
   * Update processing statistics display
   * @param {Number} totalRecords - Total records processed
   * @param {Number} validRecords - Valid records count
   * @param {Number} excludedRecords - Excluded records count
   */
  updateProcessingStats(totalRecords, validRecords, excludedRecords) {
    // Update cache status with processing info
    const cacheStatusElement = document.getElementById('cache-status');
    if (cacheStatusElement) {
      const cacheInfo = `${this.dataCache.size} items cached`;
      const processingInfo = totalRecords > 0 ? 
        ` | ${validRecords}/${totalRecords} records processed` : 
        ' | No data';
      cacheStatusElement.textContent = cacheInfo + processingInfo;
    }
    
    // Log processing statistics
    if (totalRecords > 0) {
      const qualityPercentage = ((validRecords / totalRecords) * 100).toFixed(1);
      console.log(`[INFO] AdminAnalyticsDashboard - Data processing: ${validRecords}/${totalRecords} records (${qualityPercentage}% quality)`);
      
      if (excludedRecords > 0) {
        console.warn(`[WARN] AdminAnalyticsDashboard - ${excludedRecords} records excluded due to data quality issues`);
      }
    }
  }

  /**
   * Update last updated timestamp
   */
  updateLastUpdatedTimestamp() {
    this.lastUpdated = Date.now();
    const lastUpdatedElement = document.getElementById('last-updated');
    
    if (lastUpdatedElement) {
      const timestamp = new Date(this.lastUpdated).toLocaleString();
      lastUpdatedElement.textContent = timestamp;
    }
    
    // Update cache status
    const cacheStatusElement = document.getElementById('cache-status');
    if (cacheStatusElement) {
      cacheStatusElement.textContent = `${this.dataCache.size} items cached`;
    }
  }

  /**
   * Download file from blob
   * @param {Blob} blob - File blob
   * @param {String} filename - File name
   */
  downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * Format number for display
   * @param {Number} number - Number to format
   * @returns {String} Formatted number
   */
  formatNumber(number) {
    if (typeof number !== 'number') return '0';
    return number.toLocaleString();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Stop auto-refresh
      this.stopAutoRefresh();
      
      // Stop connection retry
      this.stopConnectionRetry();
      
      // Clear cache
      this.clearCache();
      
      // Clear connection warnings
      this.clearConnectionWarnings();
      
      // Hide retry indicator
      this.hideRetryIndicator();
      
      // Destroy visualizations
      if (this.visualization) {
        this.visualization.destroyAll();
      }
      
      // Clean up filters
      if (this.filters) {
        this.filters.destroy();
      }
      
      console.log('[INFO] AdminAnalyticsDashboard - Cleanup completed');
      
    } catch (error) {
      console.error('[ERROR] AdminAnalyticsDashboard - Cleanup failed:', error.message);
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('[INFO] AdminAnalyticsDashboard - DOM loaded, initializing dashboard...');
    window.adminDashboard = new AdminAnalyticsDashboard();
  } catch (error) {
    console.error('[ERROR] AdminAnalyticsDashboard - Failed to initialize:', error.message);
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminAnalyticsDashboard;
} else if (typeof window !== 'undefined') {
  window.AdminAnalyticsDashboard = AdminAnalyticsDashboard;
}