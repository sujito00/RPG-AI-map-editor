/**
 * MCP tool handlers: route tool calls to core functions.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProject, getProjectInfo } from '../core/project.js';
import { createTileSet } from '../tileset/tileset-writer.js';
import { parseTileSet } from '../core/resource-parser.js';
import { generateScene, generateTileMapScene, addLayerToScene } from '../core/scene-writer.js';
import {
  listTileMaps,
  getTileMapInfo,
  readTiles,
  renderTileMap,
  setTiles,
  fillRect,
  eraseTiles,
  eraseRect,
} from '../tilemap/tilemap-editor.js';
import { generateVillage } from '../generators/village.js';
import { generateForest } from '../generators/forest.js';
import { generatePath } from '../generators/path.js';
import { findGodot } from '../core/godot-finder.js';
import { runGDScript, generateTerrainScript, generateScreenshotScript } from '../core/godot-runner.js';

type Args = Record<string, unknown>;

function json(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function text(msg: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: msg }] };
}

export async function handleTool(name: string, args: Args) {
  switch (name) {
    // ---- Project ----
    case 'godot_project_init': {
      await createProject(args.path as string, args.name as string);
      return text(`Project "${args.name}" created at ${args.path}`);
    }
    case 'godot_project_info': {
      const info = await getProjectInfo(args.path as string);
      return json(info);
    }

    // ---- TileSet ----
    case 'godot_tileset_create': {
      const resPath = await createTileSet({
        name: args.name as string,
        imagePath: args.image_path as string,
        tileSize: args.tile_size as number,
        outputPath: join(args.project_path as string, args.output_path as string),
        projectPath: args.project_path as string,
        physicsLayer: args.physics_layer as boolean,
      });
      return text(`TileSet created: ${resPath}`);
    }
    case 'godot_tileset_inspect': {
      const info = await parseTileSet(args.tileset_path as string);
      return json(info);
    }

    // ---- Scene / Layer ----
    case 'godot_scene_create': {
      const layers = (args.layers as Array<{ name: string; tileset_path: string; z_index?: number; visible?: boolean }>) || [];
      let content: string;
      if (layers.length > 0) {
        content = generateTileMapScene(
          layers.map(l => ({
            name: l.name,
            tileSetPath: l.tileset_path,
            zIndex: l.z_index,
            visible: l.visible,
          })),
          { rootNodeType: args.root_type as string, rootNodeName: args.root_name as string }
        );
      } else {
        content = generateScene({
          rootNodeType: args.root_type as string,
          rootNodeName: args.root_name as string,
        });
      }
      await writeFile(args.output_path as string, content, 'utf-8');
      return text(`Scene created: ${args.output_path}`);
    }
    case 'godot_layer_add': {
      await addLayerToScene(args.scene_path as string, {
        name: args.name as string,
        tileSetPath: args.tileset_path as string,
        zIndex: args.z_index as number,
      });
      return text(`Layer "${args.name}" added to ${args.scene_path}`);
    }

    // ---- TileMap Read ----
    case 'godot_tilemap_list': {
      const result = await listTileMaps(args.project_path as string);
      return json(result);
    }
    case 'godot_tilemap_info': {
      const info = await getTileMapInfo(args.scene_path as string, args.layer_name as string | undefined);
      return json(info);
    }
    case 'godot_tilemap_read': {
      const result = await readTiles(
        args.scene_path as string,
        args.layer_name as string,
        args.region as { x: number; y: number; width: number; height: number } | undefined
      );
      return json(result);
    }
    case 'godot_tilemap_render': {
      const result = await renderTileMap(
        args.scene_path as string,
        args.layer_name as string,
        (args.mode as 'source' | 'atlas') || 'source',
        args.region as { x: number; y: number; width: number; height: number } | undefined
      );
      return text(result.render + (result.bounds ? `\n\nBounds: ${JSON.stringify(result.bounds)}  Tiles: ${result.tile_count}` : ''));
    }

    // ---- TileMap Write ----
    case 'godot_tilemap_set_tiles': {
      const result = await setTiles(
        args.scene_path as string,
        args.layer_name as string,
        (args.tiles as Array<{ x: number; y: number; source_id: number; atlas_x: number; atlas_y: number; alt?: number }>).map(t => ({ ...t, alt: t.alt ?? 0 }))
      );
      return json({ success: true, ...result });
    }
    case 'godot_tilemap_fill_rect': {
      const result = await fillRect(
        args.scene_path as string,
        args.layer_name as string,
        { x: args.x as number, y: args.y as number, width: args.width as number, height: args.height as number },
        args.source_id as number,
        args.atlas_x as number,
        args.atlas_y as number,
        (args.alt as number) ?? 0
      );
      return json({ success: true, ...result });
    }
    case 'godot_tilemap_erase_tiles': {
      const result = await eraseTiles(
        args.scene_path as string,
        args.layer_name as string,
        args.positions as Array<{ x: number; y: number }>
      );
      return json({ success: true, ...result });
    }
    case 'godot_tilemap_erase_rect': {
      const result = await eraseRect(
        args.scene_path as string,
        args.layer_name as string,
        { x: args.x as number, y: args.y as number, width: args.width as number, height: args.height as number }
      );
      return json({ success: true, ...result });
    }

    // ---- Generators ----
    case 'godot_generate_village': {
      const village = generateVillage({
        centerX: args.center_x as number,
        centerY: args.center_y as number,
        width: args.width as number,
        height: args.height as number,
        houseCount: args.house_count as number,
        seed: args.seed as number,
      });

      const scenePath = args.scene_path as string;
      const groundLayer = (args.ground_layer as string) || 'Ground';
      const buildingLayer = (args.building_layer as string) || 'Buildings';
      const detailLayer = (args.detail_layer as string) || 'Details';

      const results: Record<string, unknown> = {};
      if (village.ground.length > 0) {
        results.ground = await setTiles(scenePath, groundLayer, village.ground);
      }
      if (village.buildings.length > 0) {
        results.buildings = await setTiles(scenePath, buildingLayer, village.buildings);
      }
      if (village.details.length > 0) {
        results.details = await setTiles(scenePath, detailLayer, village.details);
      }

      return json({ success: true, ...results });
    }
    case 'godot_generate_forest': {
      const forest = generateForest({
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        density: args.density as number,
        seed: args.seed as number,
      });

      const scenePath = args.scene_path as string;
      const groundLayer = (args.ground_layer as string) || 'Ground';
      const treeLayer = (args.tree_layer as string) || 'Trees';

      const results: Record<string, unknown> = {};
      if (forest.ground.length > 0) {
        results.ground = await setTiles(scenePath, groundLayer, forest.ground);
      }
      if (forest.trees.length > 0) {
        results.trees = await setTiles(scenePath, treeLayer, forest.trees);
      }

      return json({ success: true, ...results });
    }
    case 'godot_generate_path': {
      const pathTiles = generatePath({
        fromX: args.from_x as number,
        fromY: args.from_y as number,
        toX: args.to_x as number,
        toY: args.to_y as number,
        width: args.width as number,
        style: args.style as 'straight' | 'winding' | 'l-shaped',
        seed: args.seed as number,
      });

      const result = await setTiles(
        args.scene_path as string,
        args.layer_name as string,
        pathTiles
      );
      return json({ success: true, path_tiles: pathTiles.length, ...result });
    }

    // ---- Headless Godot ----
    case 'godot_terrain_resolve': {
      const godotPath = await findGodot();
      if (!godotPath) return text('Error: Godot not found. Set GODOT_PATH or install Godot 4.');

      const script = generateTerrainScript(
        args.scene_path as string,
        args.layer_name as string,
        args.terrain_set as number,
        args.terrain as number,
        args.cells as Array<{ x: number; y: number }>
      );

      const result = await runGDScript(godotPath, args.project_path as string, script);
      return text(result.stdout || result.stderr || 'Terrain resolved');
    }
    case 'godot_render_screenshot': {
      const godotPath = await findGodot();
      if (!godotPath) return text('Error: Godot not found. Set GODOT_PATH or install Godot 4.');

      const script = generateScreenshotScript(
        args.scene_path as string,
        args.output_path as string,
        (args.width as number) || 1280,
        (args.height as number) || 720
      );

      const result = await runGDScript(godotPath, args.project_path as string, script);
      return text(result.stdout || result.stderr || `Screenshot saved to ${args.output_path}`);
    }

    default:
      return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true };
  }
}
