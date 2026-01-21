document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Fetch stats from the backend
    const response = await fetch("http://localhost:5050/api/users/public-stats");
    const data = await response.json();

    if (data.success) {
      // Update the DOM elements with the fetched data
      const totalReportsEl = document.getElementById("total-reports");
      const completedPickupsEl = document.getElementById("completed-pickups");
      const activeMembersEl = document.getElementById("active-members");

      if (totalReportsEl)
        totalReportsEl.innerText = data.stats.totalReports.toLocaleString();
      if (completedPickupsEl)
        completedPickupsEl.innerText =
          data.stats.completedPickups.toLocaleString();
      if (activeMembersEl)
        activeMembersEl.innerText =
          data.stats.activeMembers.toLocaleString() + "+";
    }
  } catch (error) {
    console.error("Error loading stats:", error);
  }
});
