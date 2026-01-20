import NodeGeocoder from "node-geocoder";

// Configure geocoder with OpenStreetMap provider (free tier)
const options = {
  provider: "openstreetmap",
  httpAdapter: "https",
  formatter: null
};

const geocoder = NodeGeocoder(options);

/**
 * Converts an address string to latitude and longitude coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<Object>} - Object containing geocoding results
 */
export const geocodeAddress = async (address) => {
  try {
    // Validate input
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      throw new Error('Invalid address provided');
    }

    const trimmedAddress = address.trim();
    
    // Perform geocoding
    const results = await geocoder.geocode(trimmedAddress);
    
    if (!results || results.length === 0) {
      return {
        success: false,
        originalAddress: trimmedAddress,
        error: 'No geocoding results found for the provided address',
        latitude: null,
        longitude: null
      };
    }

    const result = results[0];
    
    // Validate coordinate precision and bounds
    const latitude = parseFloat(result.latitude);
    const longitude = parseFloat(result.longitude);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return {
        success: false,
        originalAddress: trimmedAddress,
        error: 'Invalid coordinates returned from geocoding service',
        latitude: null,
        longitude: null
      };
    }

    // Check coordinate bounds (basic validation)
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        success: false,
        originalAddress: trimmedAddress,
        error: 'Coordinates out of valid range',
        latitude: null,
        longitude: null
      };
    }

    // Round to appropriate precision (6 decimal places ~= 0.1 meter accuracy)
    const roundedLatitude = Math.round(latitude * 1000000) / 1000000;
    const roundedLongitude = Math.round(longitude * 1000000) / 1000000;

    return {
      success: true,
      originalAddress: trimmedAddress,
      latitude: roundedLatitude,
      longitude: roundedLongitude,
      provider: 'openstreetmap',
      fullResult: {
        country: result.country,
        countryCode: result.countryCode,
        city: result.city,
        zipcode: result.zipcode,
        streetName: result.streetName,
        streetNumber: result.streetNumber
      }
    };

  } catch (error) {
    console.error('Geocoding error:', error.message);
    
    return {
      success: false,
      originalAddress: address ? address.trim() : '',
      error: error.message,
      latitude: null,
      longitude: null
    };
  }
};

/**
 * Validates if coordinates are within acceptable ranges
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {boolean} - True if coordinates are valid
 */
export const validateCoordinates = (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  
  if (isNaN(latitude) || isNaN(longitude)) {
    return false;
  }
  
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

/**
 * Formats coordinates for display with appropriate precision
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {string} - Formatted coordinate string
 */
export const formatCoordinates = (latitude, longitude) => {
  if (!validateCoordinates(latitude, longitude)) {
    return 'Invalid coordinates';
  }
  
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

export default {
  geocodeAddress,
  validateCoordinates,
  formatCoordinates
};