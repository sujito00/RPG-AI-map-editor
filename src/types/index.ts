// Godot vector types
export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector2i {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Tile data as stored in Godot's binary PackedByteArray
export interface TileCell {
  x: number;
  y: number;
  source_id: number;
  atlas_x: number;
  atlas_y: number;
  alt: number;
}

// TileSet structures
export interface TileSetSource {
  sourceIndex: number;
  resourceName: string | null;
  texture: string | null;
  textureRegionSize: Vector2;
  tiles: TileDefinition[];
}

export interface TileDefinition {
  atlas_x: number;
  atlas_y: number;
  alt: number;
  customData: Record<number, unknown>;
  terrainData: TerrainData;
  [key: string]: unknown;
}

export interface TerrainData {
  terrain_set?: number;
  terrain?: number;
  peering?: Record<string, number>;
}

export interface CustomDataLayer {
  name?: string;
  type?: number;
}

export interface TerrainInfo {
  name?: string;
  color?: string;
  [key: string]: unknown;
}

export interface TerrainSet {
  mode?: number;
  terrains: TerrainInfo[];
  [key: string]: unknown;
}

export interface PhysicsLayer {
  collision_layer?: number;
  collision_mask?: number;
  [key: string]: unknown;
}

export interface TileSetInfo {
  tileSize: Vector2;
  customDataLayers: CustomDataLayer[];
  terrainSets: TerrainSet[];
  physicsLayers: PhysicsLayer[];
  sources: TileSetSource[];
  extResources: Record<string, ExtResource>;
}

// Scene parser structures
export interface ExtResource {
  type: string;
  path: string;
  uid?: string;
}

export interface SectionProperty {
  key: string;
  value: string;
  line: number;
}

export interface Section {
  header: string;
  headerLine: number;
  type: string;
  attrs: Record<string, string>;
  properties: SectionProperty[];
  startLine: number;
  endLine: number;
}

export interface ParsedScene {
  sections: Section[];
  lines: string[];
}

export interface TileMapLayerInfo {
  name: string;
  parent: string;
  tileMapDataB64: string | null;
  tileSetRef: string | null;
  tileSetExtId: string | null;
  zIndex: number;
  visible: boolean;
  position: Vector2;
  section: Section;
}

export interface TileMapBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  width: number;
  height: number;
}

// Project types
export interface ProjectInfo {
  name: string;
  path: string;
  godotVersion?: string;
  scenes: number;
  scripts: number;
  assets: number;
}

export interface GodotConfig {
  godotPath: string | null;
  projectPath: string;
}
