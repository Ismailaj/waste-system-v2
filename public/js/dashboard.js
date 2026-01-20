let map = null; // Global map variable

// Error handling utilities
function showErrorMessage(message, duration = 5000) {
  try {
    console.error('Dashboard Error:', message);
    // You could add a toast notification here
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, duration);
  } catch (error) {
    console.error('Error showing error message:', error);
  }
}

function showLoadingState(show = true) {
  try {
    const loadingElements = document.querySelectorAll('.loading-indicator');
    loadingElements.forEach(element => {
      element.style.display = show ? 'block' : 'none';
    });
  } catch (error) {
    console.error('Error managing loading state:', error);
  }
}

async function loadDashboard() {
  const token = localStorage.getItem("userToken");
  let user = {};

  // Enhanced authentication check with error handling
  try {
    if (!token) {
      console.warn('No authentication token found');
      window.location.href = "login.html";
      return;
    }

    // Safely parse user data
    try {
      user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch (parseError) {
      console.error('Error parsing user data:', parseError);
      localStorage.removeItem("user");
      localStorage.removeItem("userToken");
      window.location.href = "login.html";
      return;
    }

    // Update user name with fallback
    const userNameElement = document.getElementById("user-name");
    if (userNameElement && user && user.fullname) {
      userNameElement.innerText = user.fullname;
    }

    showLoadingState(true);

    // API call with comprehensive error handling
    const response = await fetch("http://localhost:5050/api/users/dashboard", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Authentication failed - redirecting to login');
        localStorage.removeItem("userToken");
        localStorage.removeItem("user");
        window.location.href = "login.html";
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      // Update statistics with null checks
      updateStatistics(data.stats);
      
      // Render table with error handling
      renderTable(data.reports || []);

      // Initialize map with error handling
      initializeMap(data.mapData || { hasLocations: false, locations: [] });
    } else {
      throw new Error(data.message || 'Dashboard data loading failed');
    }

  } catch (error) {
    console.error("Dashboard error:", error);
    
    // Show user-friendly error message
    if (error.message.includes('fetch')) {
      showErrorMessage('Unable to connect to server. Please check your internet connection.');
    } else if (error.message.includes('401') || error.message.includes('Authentication')) {
      showErrorMessage('Session expired. Please log in again.');
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } else {
      showErrorMessage('Error loading dashboard. Please refresh the page.');
    }
  } finally {
    showLoadingState(false);
  }
}

function updateStatistics(stats) {
  try {
    if (!stats) {
      console.warn('No statistics data provided');
      return;
    }

    const statElements = {
      'total-reports-count': stats.totalReports || 0,
      'resolved-incidents-count': stats.resolvedIncidents || 0,
      'in-progress-count': stats.inProgress || 0
    };

    Object.entries(statElements).forEach(([elementId, value]) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.innerText = value.toString();
      } else {
        console.warn(`Statistics element not found: ${elementId}`);
      }
    });

  } catch (error) {
    console.error('Error updating statistics:', error);
  }
}

// Initialize Leaflet map with user's report locations
function initializeMap(mapData) {
  const mapContainer = document.getElementById("map");
  
  try {
    if (!mapContainer) {
      console.error("Map container not found");
      return;
    }

    // Clear any existing map
    if (map) {
      try {
        map.remove();
        map = null;
      } catch (mapError) {
        console.warn('Error removing existing map:', mapError);
      }
    }

    // Validate map data
    if (!mapData || !mapData.hasLocations || !mapData.locations || mapData.locations.length === 0) {
      mapContainer.innerHTML = `
        <div class="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div class="text-center text-gray-500">
            <div class="text-4xl mb-2">[MAP]</div>
            <p class="text-lg font-medium">No locations to display</p>
            <p class="text-sm">Reports with addresses will appear here once geocoded</p>
          </div>
        </div>
      `;
      return;
    }

    const locations = mapData.locations;
    
    // Validate location data
    const validLocations = locations.filter(loc => {
      return loc && 
             typeof loc.latitude === 'number' && 
             typeof loc.longitude === 'number' &&
             !isNaN(loc.latitude) && 
             !isNaN(loc.longitude) &&
             loc.latitude >= -90 && loc.latitude <= 90 &&
             loc.longitude >= -180 && loc.longitude <= 180;
    });

    if (validLocations.length === 0) {
      mapContainer.innerHTML = `
        <div class="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div class="text-center text-gray-500">
            <div class="text-4xl mb-2">[MAP]</div>
            <p class="text-lg font-medium">Invalid location data</p>
            <p class="text-sm">Please check report coordinates</p>
          </div>
        </div>
      `;
      return;
    }

    // Calculate center point from all valid locations
    let centerLat = validLocations.reduce((sum, loc) => sum + loc.latitude, 0) / validLocations.length;
    let centerLng = validLocations.reduce((sum, loc) => sum + loc.longitude, 0) / validLocations.length;
    
    // If only one location, use it as center
    if (validLocations.length === 1) {
      centerLat = validLocations[0].latitude;
      centerLng = validLocations[0].longitude;
    }

    // Create the map with error handling
    try {
      map = L.map('map').setView([centerLat, centerLng], validLocations.length === 1 ? 15 : 12);

      // Add OpenStreetMap tiles with error handling
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSI+TWFwIEVycm9yPC90ZXh0Pjwvc3ZnPg=='
      }).addTo(map);

      // Add markers for each valid location
      validLocations.forEach((location, index) => {
        try {
          // Create marker with error handling
          const marker = L.marker([location.latitude, location.longitude]).addTo(map);

          // Create popup content with safe data handling
          const popupContent = `
            <div class="p-2">
              <h3 class="font-bold text-lg mb-2">${(location.category || 'Unknown').replace('_', ' ').toUpperCase()}</h3>
              <p class="text-sm text-gray-600 mb-1"><strong>Address:</strong> ${location.address || 'No address'}</p>
              <p class="text-sm text-gray-600 mb-1"><strong>Status:</strong> 
                <span class="px-2 py-1 rounded text-xs ${getStatusBadgeClass(location.status)}">
                  ${location.status || 'Unknown'}
                </span>
              </p>
              <p class="text-sm text-gray-600 mb-1"><strong>Date:</strong> ${location.createdAt ? new Date(location.createdAt).toLocaleDateString() : 'Unknown'}</p>
              ${location.description ? `<p class="text-sm text-gray-600"><strong>Description:</strong> ${location.description.substring(0, 100)}${location.description.length > 100 ? '...' : ''}</p>` : ''}
            </div>
          `;

          marker.bindPopup(popupContent);

          // Open popup for the most recent report (first in array)
          if (index === 0) {
            marker.openPopup();
          }
        } catch (markerError) {
          console.error(`Error creating marker for location ${index}:`, markerError);
        }
      });

      // Fit map to show all markers if multiple locations
      if (validLocations.length > 1) {
        try {
          const group = new L.featureGroup(map._layers);
          map.fitBounds(group.getBounds().pad(0.1));
        } catch (boundsError) {
          console.warn('Error fitting map bounds:', boundsError);
        }
      }

    } catch (mapCreationError) {
      console.error('Error creating map:', mapCreationError);
      mapContainer.innerHTML = `
        <div class="flex items-center justify-center h-full bg-red-50 rounded-lg">
          <div class="text-center text-red-500">
            <div class="text-4xl mb-2">⚠️</div>
            <p class="text-lg font-medium">Map Loading Error</p>
            <p class="text-sm">Unable to load map. Please refresh the page.</p>
          </div>
        </div>
      `;
    }

  } catch (error) {
    console.error('Map initialization error:', error);
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div class="flex items-center justify-center h-full bg-red-50 rounded-lg">
          <div class="text-center text-red-500">
            <div class="text-4xl mb-2">⚠️</div>
            <p class="text-lg font-medium">Map Error</p>
            <p class="text-sm">Please refresh the page to try again.</p>
          </div>
        </div>
      `;
    }
  }
}

// Helper function to get status badge classes
function getStatusBadgeClass(status) {
  switch (status) {
    case 'Completed':
    case 'Resolved':
      return 'bg-green-200 text-green-700';
    case 'Rejected':
      return 'bg-red-200 text-red-700';
    case 'Assigned':
    case 'In Progress':
      return 'bg-orange-200 text-orange-700';
    default:
      return 'bg-yellow-200 text-yellow-700';
  }
}

// Logout Button Listener
const logoutBtn = document.getElementById("logout-button");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("userToken");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    }
  });
}

function renderTable(reports) {
  const tableBody = document.getElementById("reports-table-body");
  
  try {
    if (!tableBody) {
      console.error("Reports table body not found");
      return;
    }

    tableBody.innerHTML = ""; // Clear placeholders

    // Validate reports data
    if (!Array.isArray(reports)) {
      console.error("Reports data is not an array:", reports);
      reports = [];
    }

    if (reports.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="4" class="py-8 px-4 text-center text-gray-500">
          <div class="text-4xl mb-2">[EMPTY]</div>
          <p class="text-lg font-medium">No reports yet</p>
          <p class="text-sm">Click "Report New Waste Incident" to get started</p>
        </td>
      `;
      tableBody.appendChild(row);
      return;
    }

    reports.forEach((report, index) => {
      try {
        if (!report || !report._id) {
          console.warn(`Invalid report at index ${index}:`, report);
          return;
        }

        const row = document.createElement("tr");
        row.className = "border-b hover:bg-gray-50 cursor-pointer";

        // Determine badge color based on status with fallback
        let badgeClass = "bg-yellow-200 text-yellow-700"; // Default: Pending
        const status = report.status || 'Unknown';
        
        switch (status) {
          case "Resolved":
          case "Completed":
            badgeClass = "bg-green-200 text-green-700";
            break;
          case "Rejected":
            badgeClass = "bg-red-200 text-red-700";
            break;
          case "Assigned":
          case "In Progress":
            badgeClass = "bg-orange-200 text-orange-700";
            break;
        }

        // Safe data extraction with fallbacks
        const reportId = report._id ? report._id.substring(report._id.length - 6).toUpperCase() : 'UNKNOWN';
        const category = report.category ? report.category.replace("_", " ") : 'Unknown';
        const createdDate = report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown';

        // Build rejection message HTML safely
        let rejectionMessageHtml = '';
        if (status === 'Rejected' && report.rejectionMessage) {
          const rejectedDate = report.rejectedAt ? new Date(report.rejectedAt).toLocaleDateString() : '';
          const rejectedBy = report.rejectedBy ? 
            `${report.rejectedBy.role === 'driver' ? 'Driver' : 'Admin'} (${report.rejectedBy.fullname})` : 
            'Unknown';
          
          rejectionMessageHtml = `
            <div class="text-xs text-red-600 mt-1 italic bg-red-50 p-2 rounded">
              <strong>Rejection Reason:</strong> ${report.rejectionMessage}
              ${rejectedDate ? `<br><strong>Rejected on:</strong> ${rejectedDate}` : ''}
              <br><strong>Rejected by:</strong> ${rejectedBy}
            </div>
          `;
        }

        // Inject data into the row with safe HTML
        row.innerHTML = `
          <td class="py-3 px-4 font-medium">#${reportId}</td>
          <td class="px-4 capitalize">${category}</td>
          <td class="px-4">${createdDate}</td>
          <td class="px-4">
            <span class="${badgeClass} text-sm px-3 py-1 rounded-full">
              ${status}
            </span>
            ${rejectionMessageHtml}
          </td>
        `;

        // Add click handler to show report on map if it has coordinates
        if (report.latitude && report.longitude && map && !isNaN(report.latitude) && !isNaN(report.longitude)) {
          row.addEventListener('click', () => {
            try {
              map.setView([report.latitude, report.longitude], 16);
              // Find and open the popup for this report
              map.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                  const latLng = layer.getLatLng();
                  if (Math.abs(latLng.lat - report.latitude) < 0.0001 && 
                      Math.abs(latLng.lng - report.longitude) < 0.0001) {
                    layer.openPopup();
                  }
                }
              });
            } catch (mapError) {
              console.error('Error navigating to report on map:', mapError);
            }
          });
        }

        tableBody.appendChild(row);

      } catch (rowError) {
        console.error(`Error rendering report row ${index}:`, rowError);
      }
    });

  } catch (error) {
    console.error("Error rendering reports table:", error);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 px-4 text-center text-red-500">
            <div class="text-4xl mb-2">⚠️</div>
            <p class="text-lg font-medium">Error loading reports</p>
            <p class="text-sm">Please refresh the page to try again</p>
          </td>
        </tr>
      `;
    }
  }
}

window.onload = loadDashboard;
