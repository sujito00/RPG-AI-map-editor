/**
 * Village generator: creates a simple village layout with houses and paths.
 */

import type { TileCell } from '../types/index.js';
import { makeTile, fillRectTiles, seededRandom, type TilePalette, DEFAULT_PALETTE } from './base-generator.js';

export interface VillageOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  houseCount?: number;
  seed?: number;
  palette?: Partial<TilePalette>;
}

interface House {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function generateVillage(options: VillageOptions): {
  ground: TileCell[];
  buildings: TileCell[];
  details: TileCell[];
} {
  const {
    centerX,
    centerY,
    width,
    height,
    houseCount = 3,
    seed = 42,
  } = options;
  const palette = { ...DEFAULT_PALETTE, ...options.palette };
  const rng = seededRandom(seed);

  const startX = centerX - Math.floor(width / 2);
  const startY = centerY - Math.floor(height / 2);

  // Fill ground
  const ground = fillRectTiles(startX, startY, width, height, palette.ground);

  const buildings: TileCell[] = [];
  const details: TileCell[] = [];
  const houses: House[] = [];

  // Place houses
  for (let i = 0; i < houseCount; i++) {
    const houseW = 3 + Math.floor(rng() * 3); // 3-5 wide
    const houseH = 3 + Math.floor(rng() * 2); // 3-4 tall

    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const hx = startX + 1 + Math.floor(rng() * (width - houseW - 2));
      const hy = startY + 1 + Math.floor(rng() * (height - houseH - 2));

      // Check overlap with existing houses (with 1-tile margin)
      const overlaps = houses.some(h =>
        hx < h.x + h.w + 2 && hx + houseW + 2 > h.x &&
        hy < h.y + h.h + 2 && hy + houseH + 2 > h.y
      );

      if (!overlaps) {
        houses.push({ x: hx, y: hy, w: houseW, h: houseH });

        // Walls (perimeter)
        for (let dx = 0; dx < houseW; dx++) {
          for (let dy = 0; dy < houseH; dy++) {
            if (dx === 0 || dx === houseW - 1 || dy === 0 || dy === houseH - 1) {
              buildings.push(makeTile(hx + dx, hy + dy, palette.wall));
            }
          }
        }

        // Roof (top row)
        for (let dx = 0; dx < houseW; dx++) {
          buildings.push(makeTile(hx + dx, hy, palette.roof));
        }

        // Door (bottom center)
        const doorX = hx + Math.floor(houseW / 2);
        buildings.push(makeTile(doorX, hy + houseH - 1, palette.door));

        placed = true;
        break;
      }
    }
  }

  // Connect houses with paths
  if (houses.length >= 2) {
    for (let i = 0; i < houses.length - 1; i++) {
      const from = {
        x: houses[i].x + Math.floor(houses[i].w / 2),
        y: houses[i].y + houses[i].h,
      };
      const to = {
        x: houses[i + 1].x + Math.floor(houses[i + 1].w / 2),
        y: houses[i + 1].y + houses[i + 1].h,
      };

      // L-shaped path
      const midX = from.x;
      const midY = to.y;

      // Horizontal segment
      const xStart = Math.min(from.x, to.x);
      const xEnd = Math.max(from.x, to.x);
      for (let x = xStart; x <= xEnd; x++) {
        details.push(makeTile(x, midY, palette.path));
      }

      // Vertical segment
      const yStart = Math.min(from.y, midY);
      const yEnd = Math.max(from.y, midY);
      for (let y = yStart; y <= yEnd; y++) {
        details.push(makeTile(midX, y, palette.path));
      }
    }
  }

  return { ground, buildings, details };
}
