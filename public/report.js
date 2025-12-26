const form = document.querySelector("form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const category = document.getElementById("select").value;
  const address = document.getElementById("address").value;
  const description = document.getElementById("description").value;

  const photos = document.getElementById("file-upload").files;

  const formData = new FormData();
  formData.append("category", category);
  formData.append("address", address);
  formData.append("description", description);

  for (let i = 0; i < photos.length; i++) {
    formData.append("photos", photos[i]);
  }

  try {
    const res = await fetch('http://localhost:5050/api/users/report', {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    console.log('Report response:', res.status, data);

    if (res.ok && data.success) alert("Report submitted");
    else alert(data.message || 'Submission failed');
  } catch (err) {
    console.error('Network error submitting report:', err);
    alert('Network error: could not submit report');
  }
  
});
