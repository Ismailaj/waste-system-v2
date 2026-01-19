document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("driverToken");
  const user = JSON.parse(localStorage.getItem("driverUser") || "{}");

  if (!token || user.role !== "driver") {
    window.location.href = "login.html";
    return;
  }

  const reportsContainer = document.getElementById("reportsContainer");
  const logoutBtn = document.getElementById("logoutBtn");
  const driverNameSpan = document.getElementById("driverName");

  // Modal elements
  const statusModal = document.getElementById("statusModal");
  const modalReportAddress = document.getElementById("modalReportAddress");
  const markCompletedBtn = document.getElementById("markCompletedBtn");
  const confirmRejectBtn = document.getElementById("confirmRejectBtn");
  const rejectionReasonSelect = document.getElementById(
    "rejectionReasonSelect"
  );
  const rejectError = document.getElementById("rejectError");
  const closeModalBtn = document.getElementById("closeModalBtn");

  let currentReportId = null;

  driverNameSpan.textContent = user.fullname;

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });

  // Modal logic
  const openModal = (report) => {
    currentReportId = report._id;
    modalReportAddress.textContent = `Report at: ${report.address}`;
    rejectionReasonSelect.value = "";
    rejectError.classList.add("hidden");
    statusModal.classList.remove("hidden");
  };

  const closeModal = () => {
    currentReportId = null;
    statusModal.classList.add("hidden");
  };

  closeModalBtn.addEventListener("click", closeModal);
  statusModal.addEventListener("click", (e) => {
    if (e.target === statusModal) closeModal();
  });

  markCompletedBtn.addEventListener("click", () => {
    updateReportStatus(currentReportId, "Completed");
  });

  confirmRejectBtn.addEventListener("click", () => {
    const reason = rejectionReasonSelect.value;
    if (!reason) {
      rejectError.classList.remove("hidden");
      return;
    }
    updateReportStatus(currentReportId, "Rejected", reason);
  });

  async function fetchAssignedReports() {
    try {
      const response = await fetch(
        "http://localhost:5050/api/driver/assigned",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const reports = await response.json();

      reportsContainer.innerHTML = "";

      if (reports.length === 0) {
        reportsContainer.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No tasks assigned</h3>
                <p class="mt-1 text-sm text-gray-500">You're all caught up!</p>
            </div>`;
        return;
      }

      reports.forEach((report) => {
        const card = createReportCard(report);
        reportsContainer.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      reportsContainer.innerHTML =
        '<p class="text-red-600 col-span-full text-center">Failed to load reports.</p>';
    }
  }

  function createReportCard(report) {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow";

    const statusColors = {
      Pending: "bg-yellow-100 text-yellow-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Completed: "bg-green-100 text-green-800",
      Resolved: "bg-green-100 text-green-800",
      Rejected: "bg-red-100 text-red-800",
    };

    const statusClass =
      statusColors[report.status] || "bg-gray-100 text-gray-800";

    // Format date
    const date = new Date(report.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const isActionable =
      report.status === "Pending" || report.status === "In Progress";

    let actionButtonHtml = "";
    if (isActionable) {
      actionButtonHtml = `
            <div class="mt-4 pt-4 border-t border-gray-50 self-end w-full">
                <button class="update-btn w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                    Update Status
                </button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="h-48 overflow-hidden bg-gray-200 relative group">
             ${
               report.photos && report.photos.length > 0
                 ? `<img src="${report.photos[0]}" alt="Report Image" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">`
                 : `<div class="flex items-center justify-center h-full text-gray-400">
                      <svg class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>`
             }
             <div class="absolute top-2 right-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${report.status}
                </span>
             </div>
        </div>
        <div class="p-5 flex flex-col h-[calc(100%-12rem)]">
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs text-gray-500 font-medium tracking-wide uppercase">${
                  report.category
                }</span>
                <span class="text-xs text-gray-400">${date}</span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1 leading-tight line-clamp-1">${
              report.address
            }</h3>
            ${
              report.description
                ? `<p class="text-sm text-gray-600 mb-4 line-clamp-2">${report.description}</p>`
                : ""
            }
            
            ${
              report.status === "Rejected" && report.rejectionReason
                ? `<div class="mt-auto bg-red-50 p-3 rounded-md border border-red-100">
                    <p class="text-xs font-semibold text-red-800 mb-1">Rejection Reason:</p>
                    <p class="text-xs text-red-700">${report.rejectionReason}</p>
                   </div>`
                : ""
            }

            ${actionButtonHtml}
        </div>
      `;

    if (isActionable) {
      const btn = div.querySelector(".update-btn");
      btn.addEventListener("click", () => openModal(report));
    }

    return div;
  }

  async function updateReportStatus(id, status, rejectionReason = null) {
    try {
      const body = { status };
      if (rejectionReason) body.rejectionReason = rejectionReason;

      const response = await fetch(
        `http://localhost:5050/api/driver/${id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();
      if (data.success || response.ok) {
        closeModal();
        fetchAssignedReports(); // Refresh list
      } else {
        alert(data.message || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Error updating status");
    }
  }

  fetchAssignedReports();
});
