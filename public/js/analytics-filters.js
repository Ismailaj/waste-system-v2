/**
 * Analytics Filter System - Manages filter controls and state for analytics dashboard
 * Handles date range selection, category filtering, status filtering, and filter state management
 */
class AnalyticsFilters {
  constructor() {
    this.filters = {
      startDate: null,
      endDate: null,
      category: 'all',
      status: 'all'
    };
    
    this.callbacks = {
      onFilterChange: null,
      onFilterApply: null,
      onFilterClear: null
    };
    
    this.isInitialized = false;
    this.defaultDateRange = 30; // Default to last 30 days
    
    this.init();
  }

  /**
   * Initialize filter system
   */
  init() {
    try {
      this.initializeElements();
      this.setDefaultDateRange();
      this.attachEventListeners();
      this.isInitialized = true;
      
      console.log('[INFO] AnalyticsFilters - Filter system initialized');
    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - Initialization failed:', error.message);
    }
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    // Date range elements
    this.startDateInput = document.getElementById('start-date');
    this.endDateInput = document.getElementById('end-date');
    
    // Filter elements
    this.categorySelect = document.getElementById('category-filter');
    this.statusSelect = document.getElementById('status-filter');
    
    // Button elements
    this.applyButton = document.getElementById('apply-filters');
    this.clearButton = document.getElementById('clear-filters');
    this.quick7DaysButton = document.getElementById('quick-7days');
    this.quick30DaysButton = document.getElementById('quick-30days');

    // Validate required elements
    const requiredElements = [
      { element: this.startDateInput, name: 'start-date' },
      { element: this.endDateInput, name: 'end-date' },
      { element: this.categorySelect, name: 'category-filter' },
      { element: this.statusSelect, name: 'status-filter' },
      { element: this.applyButton, name: 'apply-filters' },
      { element: this.clearButton, name: 'clear-filters' }
    ];

    const missingElements = requiredElements.filter(item => !item.element);
    if (missingElements.length > 0) {
      throw new Error(`Missing required elements: ${missingElements.map(item => item.name).join(', ')}`);
    }
  }

  /**
   * Set default date range (last 30 days, ending tomorrow to include today's data)
   */
  setDefaultDateRange() {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1); // Set to tomorrow to include today's data
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - this.defaultDateRange - 1); // Adjust for the extra day

    this.startDateInput.value = this.formatDateForInput(startDate);
    this.endDateInput.value = this.formatDateForInput(endDate);
    
    this.filters.startDate = startDate;
    this.filters.endDate = endDate;
  }

  /**
   * Attach event listeners to filter controls
   */
  attachEventListeners() {
    // Date range change listeners
    this.startDateInput.addEventListener('change', (e) => {
      this.handleDateChange('startDate', e.target.value);
    });

    this.endDateInput.addEventListener('change', (e) => {
      this.handleDateChange('endDate', e.target.value);
    });

    // Filter change listeners
    this.categorySelect.addEventListener('change', (e) => {
      this.handleFilterChange('category', e.target.value);
    });

    this.statusSelect.addEventListener('change', (e) => {
      this.handleFilterChange('status', e.target.value);
    });

    // Button listeners
    this.applyButton.addEventListener('click', () => {
      this.applyFilters();
    });

    this.clearButton.addEventListener('click', () => {
      this.clearAllFilters();
    });

    // Quick date range buttons
    if (this.quick7DaysButton) {
      this.quick7DaysButton.addEventListener('click', () => {
        this.setQuickDateRange(7);
      });
    }

    if (this.quick30DaysButton) {
      this.quick30DaysButton.addEventListener('click', () => {
        this.setQuickDateRange(30);
      });
    }

    // Enter key support for inputs
    [this.startDateInput, this.endDateInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.applyFilters();
        }
      });
    });
  }

  /**
   * Handle date range changes
   * @param {String} dateType - 'startDate' or 'endDate'
   * @param {String} value - Date value from input
   */
  handleDateChange(dateType, value) {
    try {
      if (!value) {
        this.filters[dateType] = null;
        return;
      }

      const date = new Date(value);
      if (isNaN(date.getTime())) {
        this.showError('Invalid date format');
        return;
      }

      this.filters[dateType] = date;

      // Validate date range
      if (this.filters.startDate && this.filters.endDate) {
        if (this.filters.startDate > this.filters.endDate) {
          this.showError('Start date cannot be after end date');
          return;
        }

        // Check for reasonable date range (not more than 2 years)
        const daysDiff = Math.abs(this.filters.endDate - this.filters.startDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 730) {
          this.showWarning('Date range is very large. This may affect performance.');
        }
      }

      // Trigger change callback
      if (this.callbacks.onFilterChange) {
        this.callbacks.onFilterChange(this.getActiveFilters());
      }

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - handleDateChange:', error.message);
      this.showError('Error processing date change');
    }
  }

  /**
   * Handle filter changes (category, status)
   * @param {String} filterType - Type of filter
   * @param {String} value - Filter value
   */
  handleFilterChange(filterType, value) {
    try {
      this.filters[filterType] = value;

      // Update UI to reflect filter state
      this.updateFilterUI();

      // Trigger change callback
      if (this.callbacks.onFilterChange) {
        this.callbacks.onFilterChange(this.getActiveFilters());
      }

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - handleFilterChange:', error.message);
    }
  }

  /**
   * Apply current filters
   */
  applyFilters() {
    try {
      // Validate filters before applying
      const validation = this.validateFilters();
      if (!validation.valid) {
        this.showError(validation.errors.join(', '));
        return;
      }

      // Update UI state
      this.updateApplyButtonState(true);

      // Get active filters
      const activeFilters = this.getActiveFilters();

      console.log('[INFO] AnalyticsFilters - Applying filters:', activeFilters);

      // Trigger apply callback
      if (this.callbacks.onFilterApply) {
        this.callbacks.onFilterApply(activeFilters);
      }

      // Show success feedback
      this.showSuccess('Filters applied successfully');

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - applyFilters:', error.message);
      this.showError('Error applying filters');
    } finally {
      this.updateApplyButtonState(false);
    }
  }

  /**
   * Clear all filters and reset to defaults
   */
  clearAllFilters() {
    try {
      // Reset filters to defaults
      this.filters = {
        startDate: null,
        endDate: null,
        category: 'all',
        status: 'all'
      };

      // Reset UI elements
      this.setDefaultDateRange();
      this.categorySelect.value = 'all';
      this.statusSelect.value = 'all';

      // Update UI state
      this.updateFilterUI();

      console.log('[INFO] AnalyticsFilters - All filters cleared');

      // Trigger clear callback
      if (this.callbacks.onFilterClear) {
        this.callbacks.onFilterClear();
      }

      // Show feedback
      this.showSuccess('All filters cleared');

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - clearAllFilters:', error.message);
      this.showError('Error clearing filters');
    }
  }

  /**
   * Set quick date range
   * @param {Number} days - Number of days from today
   */
  setQuickDateRange(days) {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1); // Set to tomorrow to include today's data
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days - 1); // Adjust for the extra day

      this.startDateInput.value = this.formatDateForInput(startDate);
      this.endDateInput.value = this.formatDateForInput(endDate);
      
      this.filters.startDate = startDate;
      this.filters.endDate = endDate;

      // Update UI
      this.updateFilterUI();

      // Trigger change callback
      if (this.callbacks.onFilterChange) {
        this.callbacks.onFilterChange(this.getActiveFilters());
      }

      console.log(`[INFO] AnalyticsFilters - Set quick date range: last ${days} days`);

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - setQuickDateRange:', error.message);
    }
  }

  /**
   * Get currently active filters
   * @returns {Object} Active filters object
   */
  getActiveFilters() {
    return {
      dateRange: {
        startDate: this.filters.startDate,
        endDate: this.filters.endDate
      },
      category: this.filters.category,
      status: this.filters.status,
      hasActiveFilters: this.hasActiveFilters()
    };
  }

  /**
   * Check if any filters are currently active (non-default)
   * @returns {Boolean} True if filters are active
   */
  hasActiveFilters() {
    return (
      this.filters.category !== 'all' ||
      this.filters.status !== 'all' ||
      this.isCustomDateRange()
    );
  }

  /**
   * Check if current date range is custom (not default 30 days)
   * @returns {Boolean} True if custom date range
   */
  isCustomDateRange() {
    if (!this.filters.startDate || !this.filters.endDate) {
      return false;
    }

    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - this.defaultDateRange);

    const daysDiff = Math.abs(this.filters.endDate - now) / (1000 * 60 * 60 * 24);
    const startDiff = Math.abs(this.filters.startDate - defaultStart) / (1000 * 60 * 60 * 24);

    return daysDiff > 1 || startDiff > 1; // Allow 1 day tolerance
  }

  /**
   * Validate current filters
   * @returns {Object} Validation result
   */
  validateFilters() {
    const errors = [];

    // Validate date range
    if (!this.filters.startDate || !this.filters.endDate) {
      errors.push('Start date and end date are required');
    } else if (this.filters.startDate > this.filters.endDate) {
      errors.push('Start date cannot be after end date');
    } else {
      // Check for future dates
      const now = new Date();
      if (this.filters.startDate > now) {
        errors.push('Start date cannot be in the future');
      }
      if (this.filters.endDate > now) {
        errors.push('End date cannot be in the future');
      }
    }

    // Validate category
    const validCategories = ['all', 'recyclable', 'illegal_dumping', 'hazardous_waste'];
    if (!validCategories.includes(this.filters.category)) {
      errors.push('Invalid category selection');
    }

    // Validate status
    const validStatuses = ['all', 'Pending', 'Assigned', 'In Progress', 'Completed', 'Rejected'];
    if (!validStatuses.includes(this.filters.status)) {
      errors.push('Invalid status selection');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update filter UI state
   */
  updateFilterUI() {
    // Update apply button state based on filter changes
    const hasChanges = this.hasActiveFilters();
    this.applyButton.disabled = false;
    
    if (hasChanges) {
      this.applyButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
      this.applyButton.classList.remove('bg-gray-400');
    } else {
      this.applyButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      this.applyButton.classList.add('bg-gray-400');
    }

    // Update clear button state
    this.clearButton.disabled = !hasChanges;
    
    if (hasChanges) {
      this.clearButton.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      this.clearButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  /**
   * Update apply button loading state
   * @param {Boolean} loading - Loading state
   */
  updateApplyButtonState(loading) {
    if (loading) {
      this.applyButton.disabled = true;
      this.applyButton.innerHTML = `
        <span class="material-symbols-outlined mr-2 animate-spin">refresh</span>
        Applying...
      `;
    } else {
      this.applyButton.disabled = false;
      this.applyButton.innerHTML = `
        <span class="material-symbols-outlined mr-2">filter_list</span>
        Apply Filters
      `;
    }
  }

  /**
   * Set callback functions
   * @param {Object} callbacks - Callback functions
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get filter summary for display
   * @returns {String} Human-readable filter summary
   */
  getFilterSummary() {
    const parts = [];

    // Date range
    if (this.filters.startDate && this.filters.endDate) {
      const start = this.formatDateForDisplay(this.filters.startDate);
      const end = this.formatDateForDisplay(this.filters.endDate);
      parts.push(`${start} to ${end}`);
    }

    // Category
    if (this.filters.category !== 'all') {
      const categoryNames = {
        recyclable: 'Recyclable',
        illegal_dumping: 'Illegal Dumping',
        hazardous_waste: 'Hazardous Waste'
      };
      parts.push(`Category: ${categoryNames[this.filters.category] || this.filters.category}`);
    }

    // Status
    if (this.filters.status !== 'all') {
      parts.push(`Status: ${this.filters.status}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No filters applied';
  }

  /**
   * Export current filter state
   * @returns {Object} Serializable filter state
   */
  exportFilterState() {
    return {
      startDate: this.filters.startDate ? this.filters.startDate.toISOString() : null,
      endDate: this.filters.endDate ? this.filters.endDate.toISOString() : null,
      category: this.filters.category,
      status: this.filters.status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import filter state
   * @param {Object} filterState - Previously exported filter state
   */
  importFilterState(filterState) {
    try {
      if (filterState.startDate) {
        this.filters.startDate = new Date(filterState.startDate);
        this.startDateInput.value = this.formatDateForInput(this.filters.startDate);
      }

      if (filterState.endDate) {
        this.filters.endDate = new Date(filterState.endDate);
        this.endDateInput.value = this.formatDateForInput(this.filters.endDate);
      }

      if (filterState.category) {
        this.filters.category = filterState.category;
        this.categorySelect.value = filterState.category;
      }

      if (filterState.status) {
        this.filters.status = filterState.status;
        this.statusSelect.value = filterState.status;
      }

      this.updateFilterUI();
      
      console.log('[INFO] AnalyticsFilters - Filter state imported successfully');

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - importFilterState:', error.message);
      this.showError('Error importing filter state');
    }
  }

  // Utility methods

  /**
   * Format date for input element (YYYY-MM-DD)
   * @param {Date} date - Date to format
   * @returns {String} Formatted date string
   */
  formatDateForInput(date) {
    if (!date || isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date for display (human-readable)
   * @param {Date} date - Date to format
   * @returns {String} Formatted date string
   */
  formatDateForDisplay(date) {
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Show error message
   * @param {String} message - Error message
   */
  showError(message) {
    console.error('[ERROR] AnalyticsFilters:', message);
    // In a full implementation, this would show a toast or modal
    // For now, we'll use a simple alert
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification(message, 'error');
    }
  }

  /**
   * Show warning message
   * @param {String} message - Warning message
   */
  showWarning(message) {
    console.warn('[WARNING] AnalyticsFilters:', message);
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification(message, 'warning');
    }
  }

  /**
   * Show success message
   * @param {String} message - Success message
   */
  showSuccess(message) {
    console.log('[INFO] AnalyticsFilters:', message);
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification(message, 'success');
    }
  }

  /**
   * Destroy filter system and clean up
   */
  destroy() {
    try {
      // Remove event listeners
      if (this.startDateInput) {
        this.startDateInput.removeEventListener('change', this.handleDateChange);
      }
      if (this.endDateInput) {
        this.endDateInput.removeEventListener('change', this.handleDateChange);
      }
      if (this.categorySelect) {
        this.categorySelect.removeEventListener('change', this.handleFilterChange);
      }
      if (this.statusSelect) {
        this.statusSelect.removeEventListener('change', this.handleFilterChange);
      }
      if (this.applyButton) {
        this.applyButton.removeEventListener('click', this.applyFilters);
      }
      if (this.clearButton) {
        this.clearButton.removeEventListener('click', this.clearAllFilters);
      }

      // Clear references
      this.callbacks = {};
      this.filters = {};
      this.isInitialized = false;

      console.log('[INFO] AnalyticsFilters - Filter system destroyed');

    } catch (error) {
      console.error('[ERROR] AnalyticsFilters - destroy:', error.message);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsFilters;
} else if (typeof window !== 'undefined') {
  window.AnalyticsFilters = AnalyticsFilters;
}