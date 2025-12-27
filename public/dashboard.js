async function loadDashboard() {
  const token = localStorage.getItem("userToken"); // 1. Retrieves your "ID card" from login.
  const logOutBtn = document.getElementById("logout-button");//logs user out when clicked
  const user = JSON.parse(localStorage.getItem("user")); // Retrieve the saved user object.
  if (!token) {
    window.location.href = "login.html"; // 2. No token? Redirect to login.
    return;
  }

  try {
    const response = await fetch("http://localhost:5050/api/users/dashboard", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`, // 3. Sends the token to the backend.
      },
    });

    const data = await response.json();

    if (data.success) {
      // 4. Update the Welcome Name from the token data (if saved)
      // Or just use the data returned from the API
      document.getElementById("user-name").innerText =
        data.reports[0]?.user?.fullname || "User";

      // 5. Update Stat Counters
      if (user && user.fullname) {
        document.getElementById("user-name").innerText = user.fullname;
      }
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
      logOutBtn.addEventListener("click", () => {
        alert("Are you sure you want to logout?")
        localStorage.removeItem("userToken");
        localStorage.removeItem("user");
        window.location.href = "login.html";
      });
    }
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}
function renderTable(reports) {
  const tableBody = document.getElementById("reports-table-body");
  tableBody.innerHTML = ""; // Clear placeholders

  reports.forEach((report) => {
    const row = document.createElement("tr");
    row.className = "border-b";

    // Determine badge color based on status
    let badgeClass = "bg-yellow-200 text-yellow-700"; // Default: In Progress
    if (report.status === "Resolved")
      badgeClass = "bg-green-200 text-green-700";
    if (report.status === "Rejected") badgeClass = "bg-red-200 text-red-700";

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
            </td>
        `;
    tableBody.appendChild(row);
  });
}

window.onload = loadDashboard;
