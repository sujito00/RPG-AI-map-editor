/**
 * Shared utilities for procedural map generators.
 */

import type { TileCell } from '../types/index.js';

export interface TilePalette {
  ground: { source_id: number; atlas_x: number; atlas_y: number };
  path: { source_id: number; atlas_x: number; atlas_y: number };
  wall: { source_id: number; atlas_x: number; atlas_y: number };
  water: { source_id: number; atlas_x: number; atlas_y: number };
  tree: { source_id: number; atlas_x: number; atlas_y: number };
  roof: { source_id: number; atlas_x: number; atlas_y: number };
  door: { source_id: number; atlas_x: number; atlas_y: number };
  [key: string]: { source_id: number; atlas_x: number; atlas_y: number };
}

export const DEFAULT_PALETTE: TilePalette = {
  ground: { source_id: 0, atlas_x: 0, atlas_y: 0 },
  path:   { source_id: 0, atlas_x: 1, atlas_y: 0 },
  wall:   { source_id: 0, atlas_x: 2, atlas_y: 0 },
  water:  { source_id: 0, atlas_x: 3, atlas_y: 0 },
  tree:   { source_id: 0, atlas_x: 4, atlas_y: 0 },
  roof:   { source_id: 0, atlas_x: 5, atlas_y: 0 },
  door:   { source_id: 0, atlas_x: 6, atlas_y: 0 },
};

export function makeTile(
  x: number,
  y: number,
  tile: { source_id: number; atlas_x: number; atlas_y: number }
): TileCell {
  return { x, y, source_id: tile.source_id, atlas_x: tile.atlas_x, atlas_y: tile.atlas_y, alt: 0 };
}

export function fillRectTiles(
  x: number, y: number,
  width: number, height: number,
  tile: { source_id: number; atlas_x: number; atlas_y: number }
): TileCell[] {
  const tiles: TileCell[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      tiles.push(makeTile(x + dx, y + dy, tile));
    }
  }
  return tiles;
}

/** Simple seeded RNG for reproducible generation */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
