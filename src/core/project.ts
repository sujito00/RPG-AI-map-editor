/**
 * Godot project management: create, detect, inspect.
 */

import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ProjectInfo } from '../types/index.js';

const PROJECT_GODOT_TEMPLATE = `; Engine configuration file.
; It's best edited using the editor UI and not directly,
; though it can also be manually edited.

config_version=5

[application]

config/name="{{PROJECT_NAME}}"
config/features=PackedStringArray("4.3", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720

[rendering]

textures/canvas_textures/default_texture_filter=0
`;

export async function createProject(
  projectPath: string,
  name: string
): Promise<void> {
  if (existsSync(join(projectPath, 'project.godot'))) {
    throw new Error(`Project already exists at ${projectPath}`);
  }

  await mkdir(projectPath, { recursive: true });

  // Create project.godot
  const projectConfig = PROJECT_GODOT_TEMPLATE.replace('{{PROJECT_NAME}}', name);
  await writeFile(join(projectPath, 'project.godot'), projectConfig, 'utf-8');

  // Create standard directories
  const dirs = ['scenes', 'assets', 'scripts', 'tilesets'];
  for (const dir of dirs) {
    await mkdir(join(projectPath, dir), { recursive: true });
  }

  // Create .gitignore for Godot
  await writeFile(
    join(projectPath, '.gitignore'),
    `.godot/\n*.tmp\n*.log\n`,
    'utf-8'
  );
}

export function isGodotProject(dirPath: string): boolean {
  return existsSync(join(dirPath, 'project.godot'));
}

export async function getProjectInfo(projectPath: string): Promise<ProjectInfo> {
  if (!isGodotProject(projectPath)) {
    throw new Error(`Not a Godot project: ${projectPath}`);
  }

  const projectFile = await readFile(join(projectPath, 'project.godot'), 'utf-8');
  const nameMatch = projectFile.match(/config\/name="([^"]+)"/);
  const name = nameMatch ? nameMatch[1] : projectPath.split('/').pop() || 'Unknown';

  const counts = { scenes: 0, scripts: 0, assets: 0 };
  await countFiles(projectPath, counts);

  return {
    name,
    path: projectPath,
    scenes: counts.scenes,
    scripts: counts.scripts,
    assets: counts.assets,
  };
}

async function countFiles(
  dir: string,
  counts: { scenes: number; scripts: number; assets: number }
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await countFiles(fullPath, counts);
    } else {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (ext === 'tscn') counts.scenes++;
      else if (ext === 'gd' || ext === 'cs') counts.scripts++;
      else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'wav', 'mp3', 'ogg', 'tres'].includes(ext || ''))
        counts.assets++;
    }
  }
}

/**
 * Find all .tscn scenes in a project.
 */
export async function findScenes(projectPath: string): Promise<string[]> {
  const results: string[] = [];
  await findFilesRecursive(projectPath, '.tscn', results);
  return results.map(f => relative(projectPath, f));
}

async function findFilesRecursive(dir: string, ext: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await findFilesRecursive(fullPath, ext, results);
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
}
