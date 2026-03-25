import type { GeoLocation, OfficeLocation } from '@/types/attendance';

/**
 * Get current GPS position from browser
 */
export const getCurrentPosition = (): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation tidak didukung oleh browser ini'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Izin lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi.'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Lokasi tidak tersedia. Pastikan GPS aktif.'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Timeout mendapatkan lokasi. Coba lagi.'));
                        break;
                    default:
                        reject(new Error('Gagal mendapatkan lokasi.'));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000, // Cache for 30 seconds
            }
        );
    });
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in meters
 */
export const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Check if a position is within the radius of a location
 */
export const isWithinRadius = (
    position: GeoLocation,
    location: OfficeLocation
): boolean => {
    const distance = calculateDistance(
        position.lat, position.lng,
        location.lat, location.lng
    );
    return distance <= location.radius;
};

/**
 * Find the nearest office location and return distance info
 */
export const findNearestLocation = (
    position: GeoLocation,
    locations: OfficeLocation[]
): { location: OfficeLocation; distance: number; isWithin: boolean } | null => {
    if (locations.length === 0) return null;

    let nearest = {
        location: locations[0],
        distance: calculateDistance(
            position.lat, position.lng,
            locations[0].lat, locations[0].lng
        ),
        isWithin: false,
    };

    for (const loc of locations) {
        const distance = calculateDistance(
            position.lat, position.lng,
            loc.lat, loc.lng
        );
        if (distance < nearest.distance) {
            nearest = { location: loc, distance, isWithin: false };
        }
    }

    nearest.isWithin = nearest.distance <= nearest.location.radius;
    return nearest;
};

/**
 * Check if user is within any of the allowed locations
 */
export const isWithinAnyLocation = (
    position: GeoLocation,
    locations: OfficeLocation[]
): boolean => {
    return locations.some(loc => isWithinRadius(position, loc));
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};
