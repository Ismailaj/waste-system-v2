import { geocodeAddress } from "../utils/geocoding.js";

const address = process.argv[2] || "123 Main Street, New York, NY 10001";

async function testGeocoder() {
  console.log(`[GEOCODING] Testing geocoder with address: "${address}"`);
  console.log("=====================================");
  
  try {
    const result = await geocodeAddress(address);
    
    if (result.success) {
      console.log("[SUCCESS] Geocoding successful!");
      console.log(`[COORDS] Coordinates: ${result.latitude}, ${result.longitude}`);
      console.log(`[PROVIDER] Provider: ${result.provider}`);
      console.log(`[ADDRESS] Original Address: ${result.originalAddress}`);
      
      if (result.fullResult) {
        console.log("\n[DETAILS] Additional Details:");
        console.log(`   Country: ${result.fullResult.country || 'N/A'}`);
        console.log(`   City: ${result.fullResult.city || 'N/A'}`);
        console.log(`   Zipcode: ${result.fullResult.zipcode || 'N/A'}`);
        console.log(`   Street: ${result.fullResult.streetName || 'N/A'} ${result.fullResult.streetNumber || ''}`);
      }
    } else {
      console.log("[ERROR] Geocoding failed!");
      console.log(`[REASON] Error: ${result.error}`);
      console.log(`[ADDRESS] Original Address: ${result.originalAddress}`);
    }
    
    console.log("\n[DEBUG] Full Result Object:");
    console.log(JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error("[ERROR] Unexpected Error:", err.message);
    console.error("Stack:", err.stack);
  }
}

console.log("[TEST] CleanCity Geocoding Test");
console.log("Using OpenStreetMap provider (free tier)");
console.log("Usage: npm run test:geocoder [address]");
console.log("");

testGeocoder();
