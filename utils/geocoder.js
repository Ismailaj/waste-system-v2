import NodeGeocoder from "node-geocoder";

// Configure geocoder with OpenStreetMap provider (free tier)
// This is the legacy geocoder file - use utils/geocoding.js for new implementations
const options = {
  provider: "openstreetmap",
  httpAdapter: "https",
  formatter: null
};

const geocoder = NodeGeocoder(options);

export default geocoder;
