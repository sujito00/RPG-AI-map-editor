/**
 * Create and modify Godot .tres TileSet resource files.
 * Generates valid text-format resources for Godot 4.
 */

import { writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';

export interface CreateTileSetOptions {
  name: string;
  imagePath: string;      // absolute path to the source PNG
  tileSize: number;        // e.g., 16
  outputPath: string;      // where to save the .tres
  projectPath: string;     // Godot project root
  physicsLayer?: boolean;  // add a physics layer
  terrainSetName?: string; // optional terrain set
}

/**
 * Create a .tres TileSet from a PNG tileset image.
 * Copies the image into the project if not already there,
 * then generates a TileSet resource referencing it.
 */
export async function createTileSet(options: CreateTileSetOptions): Promise<string> {
  const { name, imagePath, tileSize, outputPath, projectPath, physicsLayer, terrainSetName } = options;

  // Ensure image is inside the project
  let resImagePath: string;
  if (imagePath.startsWith(projectPath)) {
    resImagePath = 'res://' + relative(projectPath, imagePath).replace(/\\/g, '/');
  } else {
    // Copy image into project assets
    const destDir = join(projectPath, 'assets');
    const destPath = join(destDir, basename(imagePath));
    if (!existsSync(destPath)) {
      await copyFile(imagePath, destPath);
    }
    resImagePath = 'res://assets/' + basename(imagePath);
  }

  const lines: string[] = [];

  // Header
  lines.push(`[gd_resource type="TileSet" load_steps=2 format=3]`);
  lines.push('');

  // External resource for the texture
  lines.push(`[ext_resource type="Texture2D" path="${resImagePath}" id="1"]`);
  lines.push('');

  // Sub-resource: TileSetAtlasSource
  lines.push(`[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]`);
  lines.push(`texture = ExtResource("1")`);
  lines.push(`texture_region_size = Vector2i(${tileSize}, ${tileSize})`);
  lines.push('');

  // Resource section
  lines.push(`[resource]`);
  lines.push(`tile_size = Vector2i(${tileSize}, ${tileSize})`);

  if (physicsLayer) {
    lines.push(`physics_layer_0/collision_layer = 1`);
    lines.push(`physics_layer_0/collision_mask = 1`);
  }

  if (terrainSetName) {
    lines.push(`terrain_set_0/mode = 0`);
    lines.push(`terrain_set_0/terrains/0/name = "${terrainSetName}"`);
    lines.push(`terrain_set_0/terrains/0/color = Color(0.2, 0.6, 0.3, 1)`);
  }

  lines.push(`sources/0 = SubResource("TileSetAtlasSource_1")`);
  lines.push('');

  const content = lines.join('\n');
  await writeFile(outputPath, content, 'utf-8');

  return 'res://' + relative(projectPath, outputPath).replace(/\\/g, '/');
}

/**
 * Add tile definitions to an existing TileSet .tres file.
 * This registers specific tiles so Godot knows they exist.
 */
export async function registerTiles(
  tresPath: string,
  tiles: Array<{ atlas_x: number; atlas_y: number; alt?: number }>
): Promise<void> {
  const text = await readFile(tresPath, 'utf-8');
  const lines = text.split('\n');

  // Find the sub_resource for TileSetAtlasSource
  const subResIdx = lines.findIndex(l => l.includes('TileSetAtlasSource'));
  if (subResIdx === -1) {
    throw new Error('No TileSetAtlasSource found in ' + tresPath);
  }

  // Find where to insert tile definitions (before [resource] section)
  const resourceIdx = lines.findIndex(l => l.startsWith('[resource]'));
  if (resourceIdx === -1) {
    throw new Error('No [resource] section found in ' + tresPath);
  }

  // Generate tile definition lines
  const tileLines: string[] = [];
  for (const tile of tiles) {
    const alt = tile.alt ?? 0;
    tileLines.push(`${tile.atlas_x}:${tile.atlas_y}/${alt} = 0`);
  }

  // Insert before [resource]
  lines.splice(resourceIdx, 0, ...tileLines, '');
  await writeFile(tresPath, lines.join('\n'), 'utf-8');
}

/**
 * Add collision shape to a specific tile in a TileSet.
 */
export async function setTileCollision(
  tresPath: string,
  atlasX: number,
  atlasY: number,
  polygon: Array<{ x: number; y: number }>,
  tileSize: number,
  alt = 0
): Promise<void> {
  const text = await readFile(tresPath, 'utf-8');
  const lines = text.split('\n');

  const resourceIdx = lines.findIndex(l => l.startsWith('[resource]'));
  if (resourceIdx === -1) {
    throw new Error('No [resource] section found in ' + tresPath);
  }

  // Build polygon string
  const points = polygon.map(p => `Vector2(${p.x}, ${p.y})`).join(', ');
  const collisionLine = `${atlasX}:${atlasY}/${alt}/physics_layer_0/polygon_0/points = PackedVector2Array(${points})`;

  // Insert after the tile's base definition, or before [resource]
  const tileDef = `${atlasX}:${atlasY}/${alt} = 0`;
  const tileDefIdx = lines.findIndex(l => l.trim() === tileDef);

  if (tileDefIdx !== -1) {
    lines.splice(tileDefIdx + 1, 0, collisionLine);
  } else {
    // If tile def doesn't exist, add both
    lines.splice(resourceIdx, 0, tileDef, collisionLine, '');
  }

  await writeFile(tresPath, lines.join('\n'), 'utf-8');
}
