import type { ActivityDetail } from '../types';
import * as polyline from '@mapbox/polyline';

interface TrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string | null; // ISO 8601
  hr: number | null;
}

function buildTrackPoints(activity: ActivityDetail): TrackPoint[] {
  // Prefer streams data (has timestamps, HR, elevation)
  const streamsWithCoords = activity.streams?.filter(
    (s) => s.latitude != null && s.longitude != null,
  );

  if (streamsWithCoords && streamsWithCoords.length > 0) {
    const startMs = new Date(activity.startDate).getTime();
    return streamsWithCoords.map((s) => ({
      lat: s.latitude!,
      lng: s.longitude!,
      ele: s.altitude ?? null,
      time:
        s.time != null
          ? new Date(startMs + s.time * 1000).toISOString()
          : null,
      hr: s.heartRate ?? null,
    }));
  }

  // Fall back to polyline decoding (no timestamps or HR)
  const poly = activity.detailedPolyline || activity.summaryPolyline;
  if (!poly) return [];
  return polyline.decode(poly).map(([lat, lng]) => ({
    lat,
    lng,
    ele: null,
    time: null,
    hr: null,
  }));
}

export function exportGpx(activity: ActivityDetail): void {
  const points = buildTrackPoints(activity);
  if (points.length === 0) return;

  const startIso = new Date(activity.startDate).toISOString();
  const name = escapeXml(activity.name);

  const trkpts = points
    .map((p) => {
      let pt = `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">`;
      if (p.ele != null)
        pt += `\n        <ele>${p.ele.toFixed(1)}</ele>`;
      if (p.time)
        pt += `\n        <time>${p.time}</time>`;
      if (p.hr != null)
        pt +=
          `\n        <extensions><gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><gpxtpx:hr>${Math.round(p.hr)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`;
      pt += '\n      </trkpt>';
      return pt;
    })
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunTracker"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <name>${name}</name>
    <time>${startIso}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  downloadFile(gpx, `${sanitizeFilename(activity.name)}.gpx`, 'application/gpx+xml');
}

export function exportTcx(activity: ActivityDetail): void {
  const points = buildTrackPoints(activity);
  if (points.length === 0) return;

  const startIso = new Date(activity.startDate).toISOString();

  const trackpoints = points
    .map((p, i) => {
      let tp = `          <Trackpoint>`;
      if (p.time) tp += `\n            <Time>${p.time}</Time>`;
      tp += `\n            <Position>`;
      tp += `\n              <LatitudeDegrees>${p.lat.toFixed(7)}</LatitudeDegrees>`;
      tp += `\n              <LongitudeDegrees>${p.lng.toFixed(7)}</LongitudeDegrees>`;
      tp += `\n            </Position>`;
      if (p.ele != null)
        tp += `\n            <AltitudeMeters>${p.ele.toFixed(1)}</AltitudeMeters>`;
      // Approximate distance per point index
      tp += `\n            <DistanceMeters>${((activity.distance / points.length) * i).toFixed(1)}</DistanceMeters>`;
      if (p.hr != null)
        tp += `\n            <HeartRateBpm><Value>${Math.round(p.hr)}</Value></HeartRateBpm>`;
      tp += `\n          </Trackpoint>`;
      return tp;
    })
    .join('\n');

  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${activity.movingTime}</TotalTimeSeconds>
        <DistanceMeters>${activity.distance.toFixed(1)}</DistanceMeters>
        <Calories>${activity.calories ?? 0}</Calories>
        <Track>
${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

  downloadFile(tcx, `${sanitizeFilename(activity.name)}.tcx`, 'application/vnd.garmin.tcx+xml');
}

/**
 * Export a planned route (waypoints only) as a GPX route file.
 * Compatible with Garmin devices and Strava route import.
 * waypoints: array of [lat, lng] tuples
 */
export function exportRouteGpx(name: string, waypoints: [number, number][]): void {
  if (waypoints.length === 0) return;
  const safeName = escapeXml(name);
  const rtepts = waypoints
    .map(([lat, lng]) => `    <rtept lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}"/>`)
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunTracker"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
  </metadata>
  <rte>
    <name>${safeName}</name>
${rtepts}
  </rte>
</gpx>`;

  downloadFile(gpx, `${sanitizeFilename(name)}.gpx`, 'application/gpx+xml');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
}
