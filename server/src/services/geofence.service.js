const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const latitudeOne = toRadians(first.latitude);
  const latitudeTwo = toRadians(second.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkLocation(location, classroom) {
  const distance = distanceMeters(location, classroom);
  return { distance, allowed: distance <= classroom.radius_meters };
}

module.exports = { distanceMeters, checkLocation };
