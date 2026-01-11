let currentReports = [];

async function loadDriverDashboard() {
  const token = localStorage.getItem("userToken");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Check if user is a driver
  if (!user || user.role !== "driver") {
    alert("Access denied. Driver role required.");
    window.location.href = "login.html";
    return;
  }

  // Update the welcome name
  if (user && user.fullname) {
    document.getElementById("driver-name").innerText = user.fullname;
  }

  try {
    const response = await fetch("http://localhost:5050/api/users/driver/reports", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      // Update stat counters
      document.getElementById("total-assigned-count").innerText = data.stats.totalAssigned;
      document.getElementById("completed-count").innerText = data.stats.completed;
      document.getElementById("pending-count").innerText = data.stats.pending;
      document.getElementById("rejected-count").innerText = data.stats.rejected;

      // Store reports for later use
      currentReports = data.reports;

      // Render the reports table
      renderReportsTable(data.reports);
    } else {
      console.error("Failed to load driver dashboard:", data.message);
      alert("Failed to load dashboard: " + data.message);
    }
  } catch (error) {
    console.error("Driver dashboard error:", error);
    alert("Error loading dashboard. Please try again.");
  }
}

function renderReportsTable(reports) {
  const tableBody = document.getElementById("reports-table-body");
  tableBody.innerHTML = "";

  if (reports.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="7" class="py-8 px-4 text-center text-gray-500">
        <div class="text-4xl mb-2">[EMPTY]</div>
        <p class="text-lg font-medium">No assigned reports</p>
        <p class="text-sm">New assignments will appear here</p>
      </td>
    `;
    tableBody.appendChild(row);
    return;
  }

  reports.forEach((report) => {
    const row = document.createElement("tr");
    row.className = "border-b hover:bg-gray-50";

    // Determine badge color based on status
    let badgeClass = "bg-orange-200 text-orange-700"; // Default: Assigned
    if (report.status === "Completed") badgeClass = "bg-green-200 text-green-700";
    if (report.status === "Rejected") badgeClass = "bg-red-200 text-red-700";
    if (report.status === "In Progress") badgeClass = "bg-blue-200 text-blue-700";

    // Determine available actions based on status
    let actionButtons = "";
    if (report.status === "Assigned" || report.status === "In Progress") {
      actionButtons = `
        <button 
          onclick="openStatusModal('${report._id}')"
          class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          Update Status
        </button>
      `;
    } else {
      actionButtons = `
        <span class="text-gray-400 text-sm">No actions</span>
      `;
    }

    row.innerHTML = `
      <td class="py-3 px-4 font-medium">#${report._id
        .substring(report._id.length - 6)
        .toUpperCase()}</td>
      <td class="px-4 capitalize">${report.category.replace("_", " ")}</td>
      <td class="px-4 text-sm">${report.address}</td>
      <td class="px-4">${report.user ? report.user.fullname : 'Unknown'}</td>
      <td class="px-4">${new Date(report.createdAt).toLocaleDateString()}</td>
      <td class="px-4">
        <span class="${badgeClass} text-sm px-3 py-1 rounded-full">
          ${report.status}
        </span>
        ${report.status === 'Rejected' && report.rejectionMessage ? 
          `<div class="text-xs text-red-600 mt-1 italic">
            <strong>Reason:</strong> ${report.rejectionMessage}
          </div>` : ''}
      </td>
      <td class="px-4">
        ${actionButtons}
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function openStatusModal(reportId) {
  const report = currentReports.find(r => r._id === reportId);
  if (!report) {
    alert("Report not found");
    return;
  }

  // Populate modal with report details
  document.getElementById("report-id").value = reportId;
  document.getElementById("report-details").innerHTML = `
    <p><strong>ID:</strong> #${reportId.substring(reportId.length - 6).toUpperCase()}</p>
    <p><strong>Type:</strong> ${report.category.replace("_", " ")}</p>
    <p><strong>Address:</strong> ${report.address}</p>
    <p><strong>Current Status:</strong> ${report.status}</p>
    ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
  `;

  // Reset form
  document.getElementById("status-select").value = "";
  document.getElementById("rejection-message").value = "";
  document.getElementById("rejection-message-container").classList.add("hidden");

  // Show modal
  document.getElementById("status-modal").classList.remove("hidden");
  document.getElementById("status-modal").classList.add("flex");
}

function closeStatusModal() {
  document.getElementById("status-modal").classList.add("hidden");
  document.getElementById("status-modal").classList.remove("flex");
}

async function updateReportStatus(reportId, status, rejectionMessage = null) {
  const token = localStorage.getItem("userToken");

  try {
    const requestBody = { status };
    if (rejectionMessage) {
      requestBody.rejectionMessage = rejectionMessage;
    }

    const response = await fetch(`http://localhost:5050/api/users/driver/reports/${reportId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.success) {
      alert(`Report status updated to ${status} successfully!`);
      closeStatusModal();
      // Reload the dashboard to reflect changes
      loadDriverDashboard();
    } else {
      alert("Failed to update status: " + data.message);
    }
  } catch (error) {
    console.error("Error updating status:", error);
    alert("Error updating status. Please try again.");
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function() {
  // Logout button
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

  // Refresh button
  const refreshBtn = document.getElementById("refresh-button");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadDriverDashboard);
  }

  // Modal close buttons
  const closeModalBtn = document.getElementById("status-modal-close");
  const cancelBtn = document.getElementById("cancel-status-update");
  const backdrop = document.getElementById("status-modal-backdrop");

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeStatusModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeStatusModal);
  if (backdrop) backdrop.addEventListener("click", closeStatusModal);

  // Status select change handler
  const statusSelect = document.getElementById("status-select");
  if (statusSelect) {
    statusSelect.addEventListener("change", function() {
      const rejectionContainer = document.getElementById("rejection-message-container");
      if (this.value === "Rejected") {
        rejectionContainer.classList.remove("hidden");
        document.getElementById("rejection-message").required = true;
      } else {
        rejectionContainer.classList.add("hidden");
        document.getElementById("rejection-message").required = false;
      }
    });
  }

  // Status update form submission
  const statusForm = document.getElementById("status-update-form");
  if (statusForm) {
    statusForm.addEventListener("submit", function(e) {
      e.preventDefault();
      
      const reportId = document.getElementById("report-id").value;
      const status = document.getElementById("status-select").value;
      const rejectionMessage = document.getElementById("rejection-message").value;

      // Validation
      if (!status) {
        alert("Please select a status");
        return;
      }

      if (status === "Rejected") {
        if (!rejectionMessage || rejectionMessage.trim().length < 10) {
          alert("Please provide a rejection reason of at least 10 characters");
          return;
        }
      }

      // Update status
      updateReportStatus(reportId, status, status === "Rejected" ? rejectionMessage.trim() : null);
    });
  }

  // Escape key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("status-modal");
      if (!modal.classList.contains("hidden")) {
        closeStatusModal();
      }
    }
  });
});

// Load dashboard on page load
window.onload = loadDriverDashboard;