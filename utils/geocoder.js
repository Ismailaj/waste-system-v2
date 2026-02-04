import NodeGeocoder from "node-geocoder";

// Configure geocoder to use OpenStreetMap (free, no API key needed)
const options = {
  provider: "openstreetmap",
  httpAdapter: "https",
  formatter: null,
};

const geocoder = NodeGeocoder(options);

/**
 * Geocodes an address string to latitude/longitude coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
export async function geocodeAddress(address) {
  try {
    if (!address || typeof address !== "string" || address.trim() === "") {
      console.warn("Invalid address provided for geocoding");
      return null;
    }

    console.log(`🔍 Geocoding address: "${address}"`);

    const results = await geocoder.geocode(address);

    if (results && results.length > 0) {
      const { latitude, longitude } = results[0];
      console.log(
        `✅ Geocoded successfully: ${latitude}, ${longitude} for "${address}"`,
      );
      return { latitude, longitude };
    } else {
      console.warn(`⚠️ No results found for address: "${address}"`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Geocoding error for "${address}":`, error.message);
    return null;
  }
}

export default { geocodeAddress };
