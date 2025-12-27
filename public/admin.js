// Check if user is admin on load
// const incidents = document.getElementById("incidents");
// incidents.addEventListener("click", async () => {
//   await fetch("http://localhost:5050/api/users/reports",
//     {
//       headers: {
//         Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
//       },
//     }
//   )
// });

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("adminToken");
  const user = JSON.parse(localStorage.getItem("adminUser") || "{}");

  if (!token || user.role !== "admin") {
    // Redirect non-admins to login
    window.location.href = "login.html";
    return;
  }

  // Update header with user name
  const nameElement = document.querySelector(".text-right p");
  if (nameElement) {
    nameElement.innerText = user.fullname || "Admin";
  }

  // Helper to remove active class from sidebar links
  const removeActive = () => {
    document.querySelectorAll("aside a").forEach((el) => {
      el.classList.remove("bg-[#f0f4f1]", "dark:bg-[#233b26]");
      el.querySelector("span").classList.remove("text-primary");
    });
  };

  // Setup Listeners
  const incidentsBtn = document.getElementById("incidents");
  if (incidentsBtn) {
    incidentsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadDashboard();
    });
  }

  // Users Button Listener
  const usersBtn = document.getElementById("users-btn");
  if (usersBtn) {
    usersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fetchUsers();
    });
  }

  // Logout Button Listener
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "login.html";
      }
    });
  }

  loadDashboard();
});

async function loadDashboard() {
  // Update header title
  const headerTitle = document.querySelector("header h2");
  if (headerTitle) headerTitle.innerText = "Dashboard Overview";

  await fetchReports();
}

async function fetchUsers() {
  const token = localStorage.getItem("adminToken");
  const grid = document.getElementById("reports-grid");

  // Update section title
  const sectionTitle = document.querySelector(".font-bold.text-base");
  if (sectionTitle) sectionTitle.innerText = "User Management";

  // Update header title
  const headerTitle = document.querySelector("header h2");
  if (headerTitle) headerTitle.innerText = "Users";

  grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Loading users...</div>`;

  try {
    const response = await fetch("http://localhost:5050/api/users/all", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      grid.innerHTML = `<div class="col-span-full text-center text-red-500">Error: ${data.message}</div>`;
      return;
    }

    renderUsers(data.users);
  } catch (error) {
    console.error("Error fetching users:", error);
    grid.innerHTML = `<div class="col-span-full text-center text-red-500">Failed to load users</div>`;
  }
}

function renderUsers(users) {
  const grid = document.getElementById("reports-grid");
  grid.innerHTML = "";

  if (users.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">No users found.</div>`;
    return;
  }

  users.forEach((user) => {
    const card = document.createElement("div");
    card.className =
      "flex flex-col rounded-xl border border-[#dbe6dd] dark:border-[#2a402d] bg-white dark:bg-[#1a2e1d] shadow-sm overflow-hidden hover:shadow-md transition-shadow p-6";

    const date = new Date(user.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    card.innerHTML = `
        <div class="flex items-center gap-4 mb-4">
            <div class="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                ${user.fullname.charAt(0).toUpperCase()}
            </div>
            <div>
                <h3 class="font-bold text-[#111812] dark:text-white text-lg">${
                  user.fullname
                }</h3>
                <span class="px-2 py-0.5 text-xs font-bold rounded ${
                  user.role === "admin"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                } uppercase tracking-wider">
                    ${user.role}
                </span>
            </div>
        </div>
        
        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-lg">mail</span>
                <span>${user.email}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-lg">calendar_today</span>
                <span>Joined ${date}</span>
            </div>
        </div>
      `;

    grid.appendChild(card);
  });
}

async function fetchReports() {
  const token = localStorage.getItem("adminToken");
  const grid = document.getElementById("reports-grid");

  try {
    const response = await fetch("http://localhost:5050/api/users/reports", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      grid.innerHTML = `<div class="col-span-full text-center text-red-500">Error: ${data.message}</div>`;
      return;
    }

    const reports = data.reports;
    updateStats(reports);
    renderReports(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    grid.innerHTML = `<div class="col-span-full text-center text-red-500">Failed to load reports</div>`;
  }
}

function updateStats(reports) {
  // Count counts
  const pending = reports.filter((r) => r.status === "Pending").length;
  const resolved = reports.filter(
    (r) => r.status === "Completed" || r.status === "Resolved"
  ).length;

  // Update DOM
  // Note: We need to find the specific elements. Since I didn't add IDs to the stats in HTML,
  // I will assume the first number is pending (field activity) and second is resolved (system alerts) based on the layout.
  // A better approach for the future is to add IDs to these span elements.
  const statNumbers = document.querySelectorAll(".text-3xl.font-bold");
  if (statNumbers.length >= 2) {
    statNumbers[0].innerText = pending;
    statNumbers[1].innerText = resolved;
  }
}

function renderReports(reports) {
  const grid = document.getElementById("reports-grid");
  grid.innerHTML = ""; // Clear loading state

  if (reports.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">No reports found.</div>`;
    return;
  }

  reports.forEach((report) => {
    const card = document.createElement("div");
    card.className =
      "flex flex-col rounded-xl border border-[#dbe6dd] dark:border-[#2a402d] bg-white dark:bg-[#1a2e1d] shadow-sm overflow-hidden hover:shadow-md transition-shadow";

    // Format date
    const date = new Date(report.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Determine status color
    let statusColor = "bg-gray-100 text-gray-800";
    if (report.status === "Pending")
      statusColor =
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    else if (report.status === "Completed" || report.status === "Resolved")
      statusColor =
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    else if (report.status === "Rejected")
      statusColor =
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    else if (report.status === "In Progress")
      statusColor =
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";

    // Use the first photo from the array if available
    let imageSection = "";
    if (report.photos && report.photos.length > 0) {
      imageSection = `
        <div class="h-40 w-full bg-cover bg-center" style="background-image: url('${report.photos[0]}');"></div>
      `;
    } else {
      imageSection = `
        <div class="h-40 w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <span class="material-symbols-outlined text-4xl">image_not_supported</span>
        </div>
      `;
    }

    // Action Buttons based on status
    let actions = "";
    if (report.status === "Pending" || report.status === "In Progress") {
      actions = `
            <button onclick="updateStatus('${report._id}', 'Completed')" class="flex-1 py-2 text-xs font-bold text-center text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                Mark Completed
            </button>
            <button onclick="updateStatus('${report._id}', 'Rejected')" class="px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#233b26] rounded border border-gray-200 dark:border-gray-700 transition-colors">
                Dismiss
            </button>
        `;
      if (report.status === "Pending") {
        actions = `
             <button onclick="updateStatus('${report._id}', 'In Progress')" class="flex-1 py-2 text-xs font-bold text-center text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                Assign Driver
            </button>
            ${actions}
            `;
      }
    } else {
      actions = `
             <span class="text-xs text-gray-500 font-medium italic">No actions available</span>
        `;
    }

    card.innerHTML = `
      ${imageSection}
      <div class="p-4 flex flex-col gap-3 flex-1">
        <div class="flex justify-between items-start">
             <span class="px-2 py-1 text-xs font-bold rounded ${statusColor} uppercase tracking-wider">${
      report.status
    }</span>
             <span class="text-xs text-gray-500">${date}</span>
        </div>
        <div>
            <h3 class="font-bold text-[#111812] dark:text-white mb-1 line-clamp-1">${
              report.category || "General Issue"
            }</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">${
              report.description
            }</p>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
             <span class="material-symbols-outlined text-sm">location_on</span>
             <span class="truncate">${report.address}</span>
        </div>
        <div class="flex gap-2 mt-2">
            ${actions}
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Make it global so HTML buttons can call it
window.updateStatus = async (id, status) => {
  const token = localStorage.getItem("adminToken");
  if (!confirm(`Are you sure you want to mark this report as ${status}?`))
    return;

  try {
    const response = await fetch(
      `http://localhost:5050/api/users/reports/${id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      }
    );

    const data = await response.json();
    if (data.success) {
      // Refresh dashboard
      fetchReports();
    } else {
      alert("Failed to update status: " + data.message);
    }
  } catch (error) {
    console.error("Error updating status", error);
    alert("Error updating status");
  }
};
