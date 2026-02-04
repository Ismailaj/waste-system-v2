import geocoder from "../utils/geocoder.js";

const address = process.argv[2] || "29 Champs El-Elysees Paris";

async function testGeocoder() {
  console.log(`Testing geocoder with address: "${address}"`);
  try {
    const res = await geocoder.geocode(address);
    console.log("Result:");
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Error Message:", err.message);
  }
}

testGeocoder();