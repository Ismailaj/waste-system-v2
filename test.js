function getData() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("Here is your data!");
    }, 8000);
  });
}

async function showData() {
  console.log("Fetching data...");

  try {
    const result = await getData(); // waits here
    console.log("SUCCESS:", result);
  } catch (error) {
    console.log("ERROR:", error);
  }
}

showData();

// function fetchData () {
//     return new Promise ((resolve, reject) => {
//         setTimeout(() => {
//             resolve("Here is ur data");
//         }, 8000);
//     });
// }

// async function displayData () {
//     console.log("Awaiting data");
    
//     try {
//         const result = await fetchData();
//         console.log("Success", result);
//     } catch (error){
//         console.log(error);
//     }
// }
// displayData();
// createFunction();