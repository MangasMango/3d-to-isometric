export interface CompassDir {
  dir: string;
  angle: number;
}

// The 16 compass directions extracted from the game's iso_engine.py
// DIR_ANGLE dict. These match the sprite naming convention:
//   {name}_{direction}_{angle}_{frame}.png
export const COMPASS: CompassDir[] = [
  { dir: 'E',   angle: 0.0 },
  { dir: 'NEE', angle: 22.5 },
  { dir: 'NE',  angle: 45.0 },
  { dir: 'NNE', angle: 67.5 },
  { dir: 'N',   angle: 90.0 },
  { dir: 'NNW', angle: 112.5 },
  { dir: 'NW',  angle: 135.0 },
  { dir: 'NWW', angle: 157.5 },
  { dir: 'W',   angle: 180.0 },
  { dir: 'SWW', angle: 202.5 },
  { dir: 'SW',  angle: 225.0 },
  { dir: 'SSW', angle: 247.5 },
  { dir: 'S',   angle: 270.0 },
  { dir: 'SSE', angle: 292.5 },
  { dir: 'SE',  angle: 315.0 },
  { dir: 'SEE', angle: 337.5 },
];
