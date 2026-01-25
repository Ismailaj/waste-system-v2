// Global variables
let allReports = [];

async function loadDashboard() {
  const token = localStorage.getItem("userToken"); // 1. Retrieves your "ID card" from login.
  const user = JSON.parse(localStorage.getItem("user")); // Retrieve the saved user object.

  if (!token) {
    window.location.href = "login.html"; // 2. No token? Redirect to login.
    return;
  }

  // Logout Button Listener already handled globally or needs specific checking
  // We will rely on the global one if present, or add checks
  const localLogoutBtn = document.getElementById("logout-button");
  if (localLogoutBtn) {
      // Remove old listeners by cloning or just assume fresh page load
      localLogoutBtn.replaceWith(localLogoutBtn.cloneNode(true));
      document.getElementById("logout-button").addEventListener("click", () => {
        if (confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("userToken");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        }
      });
  }

  // 4. Update the Welcome Name from the token data (if saved)
  if (user && user.fullname) {
    document.getElementById("user-name").innerText = user.fullname;
  }

  // Show loading state
  const tableBody = document.getElementById("reports-table-body");
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500">Loading reports...</td></tr>`;

  try {
    // console.log("Fetching dashboard data with token:", token);
    const response = await fetch("http://localhost:5050/api/users/dashboard", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`, // 3. Sends the token to the backend.
      },
    });

    console.log("Dashboard response status:", response.status);
    const data = await response.json();
    console.log("Dashboard data:", data);

    // 5. Update Stat Counters
    if (data.success) {
      console.log("Updating stats and table...");
      document.getElementById("total-reports-count").innerText =
        `${data.stats.totalReports}`;
      document.getElementById("resolved-incidents-count").innerText =
        `${data.stats.resolvedIncidents}`;
      document.getElementById("in-progress-count").innerText =
        `${data.stats.inProgress}`;

      // Store reports globally
      allReports = data.reports;

      // 6. Render the Table (Initial load)
      renderTable(allReports);

      // Notification Logic
      updateNotificationBadge(allReports);

      // 7. Render Eco Tip
      displayRandomTip();
    } else {
        console.error("Dashboard API returned success: false", data.message);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-red-500">Error: ${data.message}</td></tr>`;
    }
  } catch (error) {
    console.error("Dashboard error:", error);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-red-500">Failed to load reports. View console for details.</td></tr>`;
  }
}

// Filter Logic
const filterEl = document.getElementById("status-filter");
if (filterEl) {
  filterEl.addEventListener("change", (e) => {
    const status = e.target.value;
    if (status === "All") {
      renderTable(allReports);
    } else {
      const filtered = allReports.filter((r) => r.status === status);
      renderTable(filtered);
    }
  });
}

function renderTable(reports) {
  const tableBody = document.getElementById("reports-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = ""; // Clear placeholders

  if (reports.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500">No reports found via filter.</td></tr>`;
    return;
  }

  reports.forEach((report) => {
    const row = document.createElement("tr");
    row.className = "border-b hover:bg-gray-50 transition";

    // Determine badge color based on status
    let badgeClass = "bg-yellow-200 text-yellow-700"; // Default: In Progress
    if (report.status === "Resolved" || report.status === "Completed")
      badgeClass = "bg-green-200 text-green-700";
    if (report.status === "Rejected") badgeClass = "bg-red-200 text-red-700";

    // 7. Injecting real data into the row
    row.innerHTML = `
            <td class="py-3 px-4 font-medium italic text-gray-700">#${report._id
              .substring(report._id.length - 6)
              .toUpperCase()}</td>
            <td class="py-3 px-4 capitalize">${report.category.replace(
              "_",
              " ",
            )}</td>
            <td class="py-3 px-4 text-gray-500">${new Date(
              report.createdAt,
            ).toLocaleDateString()}</td>
            <td class="py-3 px-4">
                <span class="${badgeClass} text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    ${report.status}
                </span>
            </td>
            <td class="py-3 px-4 text-sm text-gray-500">
                ${report.status === "Rejected" && report.rejectionReason
                    ? `<span class="text-red-500 flex items-center gap-1"><span class="material-symbols-outlined text-sm">info</span> ${report.rejectionReason}</span>`
                    : `<span class="text-gray-400 italic">No notes</span>`
                }
            </td>
            <td class="py-3 px-4">
               <button onclick="openReportDetails('${
                 report._id
               }')" class="bg-gray-100 hover:bg-blue-100 text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-sm">visibility</span> View
               </button>
            </td>
        `;
    tableBody.appendChild(row);
  });
}

function displayRandomTip() {
  const tips = [
    "Recycling one aluminum can saves enough energy to run a TV for 3 hours.",
    "Glass bottles can take up to 4,000 years to decompose if not recycled.",
    "Composting organic waste can reduce your household trash by up to 30%.",
    "Switching to reusable bags keeps hundreds of plastic bags out of landfills every year.",
    "Rinsing your recyclables prevents contamination and ensures they get processed correctly.",
    "Donating old clothes and electronics is a great way to extend their lifecycle.",
    "Using a reusable water bottle can save you money and reduce plastic waste.",
    "Paper can be recycled 5 to 7 times before the fibers become too short.",
    "Turning off the tap while brushing your teeth can save up to 8 gallons of water a day.",
    "Buying in bulk uses less packaging helps reduce overall plastic consumption.",
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  const tipElement = document.getElementById("eco-tip-content");
  if (tipElement) {
    tipElement.innerText = randomTip;
  }
}

// Expose to window for onclick
window.openReportDetails = function (id) {
  const report = allReports.find((r) => r._id === id);
  if (!report) return;

  // Populate Modal
  document.getElementById("details-category").innerText =
    report.category.replace("_", " ");
  document.getElementById("details-date").innerText = new Date(
    report.createdAt,
  ).toLocaleString();
  document.getElementById("details-description").innerText =
    report.description || "No description provided.";

  // Image
  const imgEl = document.getElementById("details-image");
  const imageSource =
    report.photos && report.photos.length > 0
      ? report.photos[0]
      : report.imageUrl;

  if (imageSource) {
    let src = imageSource;
    if (!src.startsWith("http") && !src.startsWith("/")) {
      src = "/" + src;
    }
    imgEl.src = src;
    imgEl.classList.remove("hidden");
  } else {
    imgEl.src = "https://via.placeholder.com/400x300?text=No+Image";
  }

  // Status Badge in Modal
  const statusEl = document.getElementById("details-status");
  statusEl.innerText = report.status;
  statusEl.className =
    "inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ";
  if (report.status === "Resolved" || report.status === "Completed") {
    statusEl.classList.add("bg-green-200", "text-green-700");
  } else if (report.status === "Rejected") {
    statusEl.classList.add("bg-red-200", "text-red-700");
  } else {
    statusEl.classList.add("bg-yellow-200", "text-yellow-700");
  }

  // Show rejection reason if exists
  const feedbackSection = document.getElementById("details-feedback-section");
  if (report.status === "Rejected" && report.rejectionReason) {
    document.getElementById("details-feedback").innerText =
      report.rejectionReason;
    feedbackSection.classList.remove("hidden");
  } else {
    feedbackSection.classList.add("hidden");
  }

  // Show Modal
  const modal = document.getElementById("details-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

// Close Modal Logic
const detailsModal = document.getElementById("details-modal");
const closeDetailsBtn = document.getElementById("details-modal-close");
const closeDetailsBtn2 = document.getElementById("details-modal-close-btn");
const detailsBackdrop = document.getElementById("details-modal-backdrop");

function closeDetailsModal() {
  if (detailsModal) {
    detailsModal.classList.add("hidden");
    detailsModal.classList.remove("flex");
  }
}

if (closeDetailsBtn)
  closeDetailsBtn.addEventListener("click", closeDetailsModal);
if (closeDetailsBtn2)
  closeDetailsBtn2.addEventListener("click", closeDetailsModal);
if (detailsBackdrop)
  detailsBackdrop.addEventListener("click", closeDetailsModal);

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

const homeBtn = document.querySelector(".home-btn");
if (homeBtn) {
  homeBtn.addEventListener("click", () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("user");
  });
}

window.onload = loadDashboard;

// Notification System
let relevantNotifications = [];

function updateNotificationBadge(reports) {
  // Filter for Completed or Rejected reports
  relevantNotifications = reports.filter(
    (r) => r.status === "Completed" || r.status === "Rejected",
  );

  // Get read IDs from localStorage
  const readIds = JSON.parse(localStorage.getItem("readNotifications") || "[]");

  // Count unread
  const unreadCount = relevantNotifications.filter(
    (r) => !readIds.includes(r._id),
  ).length;

  const badge = document.getElementById("notification-badge");
  if (badge) {
    if (unreadCount > 0) {
      badge.innerText = unreadCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

// Expose to window
window.toggleNotifications = function () {
  const dropdown = document.getElementById("notification-dropdown");
  const list = document.getElementById("notification-list");
  const badge = document.getElementById("notification-badge");

  if (!dropdown) return;

  if (dropdown.classList.contains("hidden")) {
    // Opening dropdown
    dropdown.classList.remove("hidden");

    // Populate list
    list.innerHTML = "";

    if (relevantNotifications.length === 0) {
      list.innerHTML = `<p class="text-xs text-gray-500 p-4 text-center">No notifications yet.</p>`;
    } else {
      // Sort by newest first
      relevantNotifications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      relevantNotifications.forEach((r) => {
        const item = document.createElement("div");
        item.className = "p-3 border-b hover:bg-gray-50 cursor-pointer text-xs";
        // Simple Alert Message Only
        // If rejected, show reason, else just status
        let message = `Status updated to <span class="${
          r.status === "Completed" ? "text-green-600" : "text-red-600"
        } font-bold">${r.status}</span>`;

        item.innerHTML = `
                    <div class="flex items-start gap-2">
                         <span class="material-symbols-outlined ${
                           r.status === "Completed"
                             ? "text-green-600"
                             : "text-red-600"
                         } text-sm mt-0.5">${
                           r.status === "Completed" ? "check_circle" : "error"
                         }</span>
                        <div>
                            <p class="font-bold">Report #${r._id
                              .substring(r._id.length - 6)
                              .toUpperCase()}</p>
                            <p class="text-gray-600">${message}</p>
                            <p class="text-gray-400 mt-1">${new Date(
                              r.createdAt,
                            ).toLocaleDateString()}</p>
                        </div>
                    </div>
                `;
        // No click detail needed as per request, just info
        list.appendChild(item);
      });
    }

    // Mark all as read
    const allIds = relevantNotifications.map((r) => r._id);
    localStorage.setItem("readNotifications", JSON.stringify(allIds));

    // Hide badge
    if (badge) badge.classList.add("hidden");
  } else {
    // Closing dropdown
    dropdown.classList.add("hidden");
  }
};

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("notification-dropdown");
  // If click is outside the dropdown logic handled by bubbling, but we need to ensure specific targeting
  if (
    dropdown &&
    !dropdown.classList.contains("hidden") &&
    !e.target.closest(".relative.cursor-pointer")
  ) {
    dropdown.classList.add("hidden");
  }
});
