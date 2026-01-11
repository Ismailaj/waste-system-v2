let map = null; // Global map variable

async function loadDashboard() {
  const token = localStorage.getItem("userToken"); // 1. Retrieves your "ID card" from login.
  const user = JSON.parse(localStorage.getItem("user")); // Retrieve the saved user object.

  if (!token) {
    window.location.href = "login.html"; // 2. No token? Redirect to login.
    return;
  }

  // 4. Update the Welcome Name from the token data (if saved)
  if (user && user.fullname) {
    document.getElementById("user-name").innerText = user.fullname;
  }

  try {
    const response = await fetch("http://localhost:5050/api/users/dashboard", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`, // 3. Sends the token to the backend.
      },
    });

    const data = await response.json();

    // 5. Update Stat Counters
    if (data.success) {
      document.getElementById(
        "total-reports-count"
      ).innerText = `${data.stats.totalReports}`;
      document.getElementById(
        "resolved-incidents-count"
      ).innerText = `${data.stats.resolvedIncidents}`;
      document.getElementById(
        "in-progress-count"
      ).innerText = `${data.stats.inProgress}`;

      // 6. Render the Table
      renderTable(data.reports);

      // 7. Initialize and render the map
      initializeMap(data.mapData);
    }
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

// Initialize Leaflet map with user's report locations
function initializeMap(mapData) {
  const mapContainer = document.getElementById("map");
  
  if (!mapContainer) {
    console.error("Map container not found");
    return;
  }

  // Clear any existing map
  if (map) {
    map.remove();
  }

  // Check if there are locations to display
  if (!mapData.hasLocations || mapData.locations.length === 0) {
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

  // Initialize the map
  const locations = mapData.locations;
  
  // Calculate center point from all locations
  let centerLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
  let centerLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
  
  // If only one location, use it as center
  if (locations.length === 1) {
    centerLat = locations[0].latitude;
    centerLng = locations[0].longitude;
  }

  // Create the map
  map = L.map('map').setView([centerLat, centerLng], locations.length === 1 ? 15 : 12);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add markers for each location
  locations.forEach((location, index) => {
    // Create custom icon based on status
    let iconColor = 'blue';
    if (location.status === 'Completed' || location.status === 'Resolved') {
      iconColor = 'green';
    } else if (location.status === 'Rejected') {
      iconColor = 'red';
    } else if (location.status === 'Assigned' || location.status === 'In Progress') {
      iconColor = 'orange';
    }

    // Create marker
    const marker = L.marker([location.latitude, location.longitude]).addTo(map);

    // Create popup content
    const popupContent = `
      <div class="p-2">
        <h3 class="font-bold text-lg mb-2">${location.category.replace('_', ' ').toUpperCase()}</h3>
        <p class="text-sm text-gray-600 mb-1"><strong>Address:</strong> ${location.address}</p>
        <p class="text-sm text-gray-600 mb-1"><strong>Status:</strong> 
          <span class="px-2 py-1 rounded text-xs ${getStatusBadgeClass(location.status)}">
            ${location.status}
          </span>
        </p>
        <p class="text-sm text-gray-600 mb-1"><strong>Date:</strong> ${new Date(location.createdAt).toLocaleDateString()}</p>
        ${location.description ? `<p class="text-sm text-gray-600"><strong>Description:</strong> ${location.description}</p>` : ''}
      </div>
    `;

    marker.bindPopup(popupContent);

    // Open popup for the most recent report (first in array)
    if (index === 0) {
      marker.openPopup();
    }
  });

  // Fit map to show all markers if multiple locations
  if (locations.length > 1) {
    const group = new L.featureGroup(map._layers);
    map.fitBounds(group.getBounds().pad(0.1));
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
  tableBody.innerHTML = ""; // Clear placeholders

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

  reports.forEach((report) => {
    const row = document.createElement("tr");
    row.className = "border-b hover:bg-gray-50 cursor-pointer";

    // Determine badge color based on status
    let badgeClass = "bg-yellow-200 text-yellow-700"; // Default: Pending
    if (report.status === "Resolved" || report.status === "Completed")
      badgeClass = "bg-green-200 text-green-700";
    if (report.status === "Rejected") badgeClass = "bg-red-200 text-red-700";
    if (report.status === "Assigned" || report.status === "In Progress") 
      badgeClass = "bg-orange-200 text-orange-700";

    // 7. Injecting real data into the row
    row.innerHTML = `
      <td class="py-3 px-4 font-medium">#${report._id
        .substring(report._id.length - 6)
        .toUpperCase()}</td>
      <td class="px-4 capitalize">${report.category.replace(
        "_",
        " "
      )}</td>
      <td class="px-4">${new Date(
        report.createdAt
      ).toLocaleDateString()}</td>
      <td class="px-4">
        <span class="${badgeClass} text-sm px-3 py-1 rounded-full">
          ${report.status}
        </span>
        ${report.status === 'Rejected' && report.rejectionMessage ? 
          `<div class="text-xs text-red-600 mt-1 italic bg-red-50 p-2 rounded">
            <strong>Rejection Reason:</strong> ${report.rejectionMessage}
            ${report.rejectedAt ? `<br><strong>Rejected on:</strong> ${new Date(report.rejectedAt).toLocaleDateString()}` : ''}
            ${report.rejectedBy ? `<br><strong>Rejected by:</strong> ${report.rejectedBy.role === 'driver' ? 'Driver' : 'Admin'} (${report.rejectedBy.fullname})` : ''}
          </div>` : ''}
      </td>
    `;

    // Add click handler to show report on map if it has coordinates
    if (report.latitude && report.longitude && map) {
      row.addEventListener('click', () => {
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
      });
    }

    tableBody.appendChild(row);
  });
}

window.onload = loadDashboard;
