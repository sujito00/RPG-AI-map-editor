/**
 * Parse Godot 4 .tres TileSet resource files.
 *
 * Extracts: tile_size, custom_data_layers, terrain_sets, physics_layers,
 *           sources (TileSetAtlasSource) with their tile definitions.
 */

import { readFile } from 'node:fs/promises';
import type {
  TileSetInfo,
  TileSetSource,
  TileDefinition,
  TerrainData,
  CustomDataLayer,
  TerrainSet,
  PhysicsLayer,
  Vector2,
  ExtResource,
} from '../types/index.js';

interface TresSection {
  type: string;
  attrs: Record<string, string>;
  properties: Array<{ key: string; value: string }>;
  startLine: number;
  endLine: number;
}

function parseHeaderAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)=("(?:[^"\\]|\\.)*"|\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    attrs[m[1]] = val;
  }
  return attrs;
}

function parseSections(text: string): TresSection[] {
  const lines = text.split('\n');
  const sections: TresSection[] = [];
  let current: TresSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hm = line.match(/^\[(\w+)(\s+.*?)?\]\s*$/);
    if (hm) {
      if (current) {
        current.endLine = i - 1;
        sections.push(current);
      }
      current = {
        type: hm[1],
        attrs: parseHeaderAttrs((hm[2] || '').trim()),
        properties: [],
        startLine: i,
        endLine: -1,
      };
    } else if (current && line.trim().length > 0) {
      const pm = line.match(/^(\S+)\s*=\s*(.*)/);
      if (pm) current.properties.push({ key: pm[1], value: pm[2].trim() });
    }
  }
  if (current) {
    current.endLine = lines.length - 1;
    sections.push(current);
  }
  return sections;
}

function parseGodotValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);

  const vecMatch = raw.match(/Vector2i?\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
  if (vecMatch) return { x: parseFloat(vecMatch[1]), y: parseFloat(vecMatch[2]) };

  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);

  const extMatch = raw.match(/ExtResource\("([^"]+)"\)/);
  if (extMatch) return { _extResource: extMatch[1] };

  const subMatch = raw.match(/SubResource\("([^"]+)"\)/);
  if (subMatch) return { _subResource: subMatch[1] };

  return raw;
}

function parseAtlasSource(
  section: TresSection,
  sourceIndex: number,
  extResources: Record<string, ExtResource>
): TileSetSource {
  let texture: string | null = null;
  let textureRegionSize: Vector2 = { x: 16, y: 16 };
  let resourceName: string | null = null;

  for (const p of section.properties) {
    if (p.key === 'texture') {
      const v = parseGodotValue(p.value) as { _extResource?: string } | null;
      if (v && typeof v === 'object' && '_extResource' in v) {
        const ext = extResources[v._extResource!];
        texture = ext ? ext.path : v._extResource!;
      }
    } else if (p.key === 'texture_region_size') {
      textureRegionSize = parseGodotValue(p.value) as Vector2;
    } else if (p.key === 'resource_name') {
      resourceName = parseGodotValue(p.value) as string;
    }
  }

  const tiles: Record<string, TileDefinition> = {};
  for (const p of section.properties) {
    const tm = p.key.match(/^(\d+):(\d+)\/(\d+)(?:\/(.+))?$/);
    if (!tm) continue;

    const ax = parseInt(tm[1], 10);
    const ay = parseInt(tm[2], 10);
    const alt = parseInt(tm[3], 10);
    const prop = tm[4] || null;
    const tileKey = `${ax}:${ay}/${alt}`;

    if (!tiles[tileKey]) {
      tiles[tileKey] = { atlas_x: ax, atlas_y: ay, alt, customData: {}, terrainData: {} };
    }

    if (!prop) {
      // base definition
    } else if (prop.startsWith('custom_data_')) {
      const ci = parseInt(prop.replace('custom_data_', ''), 10);
      tiles[tileKey].customData[ci] = parseGodotValue(p.value);
    } else if (prop === 'terrain_set') {
      tiles[tileKey].terrainData.terrain_set = parseGodotValue(p.value) as number;
    } else if (prop === 'terrain') {
      tiles[tileKey].terrainData.terrain = parseGodotValue(p.value) as number;
    } else if (prop.startsWith('terrains_peering_bit/')) {
      const bit = prop.replace('terrains_peering_bit/', '');
      if (!tiles[tileKey].terrainData.peering) tiles[tileKey].terrainData.peering = {};
      tiles[tileKey].terrainData.peering![bit] = parseGodotValue(p.value) as number;
    }
  }

  // Animation properties
  for (const p of section.properties) {
    const am = p.key.match(/^(\d+):(\d+)\/(animation_\w+)$/);
    if (!am) continue;
    const ax = parseInt(am[1], 10);
    const ay = parseInt(am[2], 10);
    const prop = am[3];
    for (const tk of Object.keys(tiles)) {
      if (tk.startsWith(`${ax}:${ay}/`)) {
        tiles[tk][prop] = parseGodotValue(p.value);
      }
    }
  }

  return {
    sourceIndex,
    resourceName,
    texture,
    textureRegionSize,
    tiles: Object.values(tiles),
  };
}

export async function parseTileSet(filePath: string): Promise<TileSetInfo> {
  const text = await readFile(filePath, 'utf-8');
  const sections = parseSections(text);

  const extResources: Record<string, ExtResource> = {};
  for (const s of sections) {
    if (s.type === 'ext_resource') {
      extResources[s.attrs.id] = {
        type: s.attrs.type,
        path: s.attrs.path,
        uid: s.attrs.uid,
      };
    }
  }

  const subResources: Record<string, TresSection> = {};
  for (const s of sections) {
    if (s.type === 'sub_resource') {
      subResources[s.attrs.id] = s;
    }
  }

  const resourceSection = sections.find(s => s.type === 'resource');
  if (!resourceSection) {
    throw new Error(`No [resource] section found in ${filePath}`);
  }

  // tile_size
  let tileSize: Vector2 = { x: 16, y: 16 };
  const tileSizeProp = resourceSection.properties.find(p => p.key === 'tile_size');
  if (tileSizeProp) tileSize = parseGodotValue(tileSizeProp.value) as Vector2;

  // custom_data_layers
  const customDataLayers: CustomDataLayer[] = [];
  for (const p of resourceSection.properties) {
    const cdm = p.key.match(/^custom_data_layer_(\d+)\/(\w+)$/);
    if (cdm) {
      const idx = parseInt(cdm[1], 10);
      while (customDataLayers.length <= idx) customDataLayers.push({});
      const field = cdm[2] as keyof CustomDataLayer;
      (customDataLayers[idx] as Record<string, unknown>)[field] = parseGodotValue(p.value);
    }
  }

  // terrain_sets
  const terrainSets: TerrainSet[] = [];
  for (const p of resourceSection.properties) {
    const tsm = p.key.match(/^terrain_set_(\d+)\/(.+)$/);
    if (tsm) {
      const idx = parseInt(tsm[1], 10);
      while (terrainSets.length <= idx) terrainSets.push({ terrains: [] });
      const rest = tsm[2];
      const tm = rest.match(/^terrains\/(\d+)\/(\w+)$/);
      if (tm) {
        const ti = parseInt(tm[1], 10);
        while (terrainSets[idx].terrains.length <= ti) terrainSets[idx].terrains.push({});
        (terrainSets[idx].terrains[ti] as Record<string, unknown>)[tm[2]] = parseGodotValue(p.value);
      } else {
        (terrainSets[idx] as Record<string, unknown>)[rest] = parseGodotValue(p.value);
      }
    }
  }

  // physics_layers
  const physicsLayers: PhysicsLayer[] = [];
  for (const p of resourceSection.properties) {
    const plm = p.key.match(/^physics_layer_(\d+)\/(.+)$/);
    if (plm) {
      const idx = parseInt(plm[1], 10);
      while (physicsLayers.length <= idx) physicsLayers.push({});
      (physicsLayers[idx] as Record<string, unknown>)[plm[2]] = parseGodotValue(p.value);
    }
  }

  // sources
  const sources: TileSetSource[] = [];
  for (const p of resourceSection.properties) {
    const sm = p.key.match(/^sources\/(\d+)$/);
    if (sm) {
      const sourceIdx = parseInt(sm[1], 10);
      const val = parseGodotValue(p.value) as { _subResource?: string } | null;
      if (val && typeof val === 'object' && '_subResource' in val) {
        const subSec = subResources[val._subResource!];
        if (subSec && subSec.attrs.type === 'TileSetAtlasSource') {
          sources.push(parseAtlasSource(subSec, sourceIdx, extResources));
        }
      }
    }
  }

  return {
    tileSize,
    customDataLayers,
    terrainSets,
    physicsLayers,
    sources,
    extResources,
  };
}
