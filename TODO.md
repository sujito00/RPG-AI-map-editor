# godot-map-cli - TODO

## Estado actual

**Lo que funciona (verificado end-to-end):**

| Modulo | Archivos | Estado |
|---|---|---|
| Tipos TypeScript | `src/types/index.ts` | OK |
| Codificador binario tiles (PackedByteArray) | `src/core/tile-data.ts` | OK |
| Parser .tscn | `src/core/scene-parser.ts` | OK |
| Parser .tres (TileSet) | `src/core/resource-parser.ts` | OK |
| Escritor .tscn (escenas + layers) | `src/core/scene-writer.ts` | OK |
| Escritor .tres (TileSet desde PNG) | `src/tileset/tileset-writer.ts` | OK |
| Detector Godot (macOS/Linux/Win) | `src/core/godot-finder.ts` | OK |
| Runner headless Godot | `src/core/godot-runner.ts` | OK (scripts generados, no testeado con Godot) |
| Proyecto (init/info) | `src/core/project.ts` | OK |
| Editor TileMap (place/fill/erase/read/render) | `src/tilemap/tilemap-editor.ts` | OK |
| Generadores (village/forest/path) | `src/generators/*.ts` | OK (logica, no testeado visual) |
| CLI (commander.js, 18 comandos) | `src/cli.ts` | OK |
| MCP Server (20 tools) | `src/mcp-server.ts` + `src/mcp/*.ts` | OK (compila, no testeado con Claude) |

**Total: ~2,200 lineas TS (sin contar package-lock)**

---

## Pendiente por prioridad

### P0 - Critico para usabilidad

- [ ] **Configurar MCP en Claude Code**: Agregar a `~/.claude/settings.json` y probar que Claude puede usar los tools. Verificar que el server arranca, responde a list_tools, y ejecuta operaciones.

- [ ] **Testear con proyecto real (djinncom)**: Apuntar el CLI al proyecto existente en `~/CodeProjects/djinncom`, inspeccionar el tileset ArMM1998, leer los tilemaps existentes, verificar que no corrompe nada.

- [ ] **Tests automatizados**: No hay ni un test. Crear al menos:
  - `tests/tile-data.test.ts` - encode/decode roundtrip
  - `tests/scene-parser.test.ts` - parse .tscn, find layers
  - `tests/tilemap-editor.test.ts` - place/read/erase cycle
  - `tests/scene-writer.test.ts` - generate scene, verify valid .tscn
  - Fixtures: copiar un .tscn y .tres reales de djinncom a `tests/fixtures/`

### P1 - Funcionalidad importante faltante

- [ ] **TileSet: registrar tiles individuales**: `tileset-writer.ts` tiene `registerTiles()` y `setTileCollision()` pero no estan expuestos en CLI ni MCP. Agregar comandos `tileset register-tiles` y `tileset set-collision`.

- [ ] **TileSet: configurar terrains**: Agregar `tileset add-terrain` que escriba terrain_set y peering bits en el .tres. Necesario para que el autotiling funcione.

- [ ] **Terrain painting (headless Godot)**: `godot-runner.ts` genera el GDScript pero no se ha probado end-to-end. Testear con:
  1. Crear proyecto con tileset que tenga terrains configurados
  2. Pintar celdas con `set_tiles`
  3. Ejecutar `terrain-resolve`
  4. Abrir en Godot y verificar que el autotiling se resolvio

- [ ] **Generadores: palette configurable**: Los generadores usan `DEFAULT_PALETTE` con atlas coords hardcodeados (0,0), (1,0), etc. Necesitan aceptar un palette real mapeado al tileset especifico del usuario.

- [ ] **Render screenshot**: `generateScreenshotScript()` usa `await` en un script `@tool extends SceneTree` que puede no funcionar en headless. Probar y ajustar.

### P2 - Mejoras de calidad

- [ ] **README.md**: Documentacion con:
  - Quick start (init, create tileset, create scene, place tiles)
  - Configuracion MCP para Claude Code
  - Lista completa de comandos CLI
  - Lista completa de MCP tools
  - Arquitectura (diagrama Mermaid)

- [ ] **Validacion de inputs**: Los MCP handlers hacen `as string` sin validar. Agregar validacion basica (path existe, numeros son numeros, layer name no vacio).

- [ ] **Error handling en scene writer**: `addLayerToScene` no maneja bien scenes sin header `load_steps` (scenes minimas creadas con `generateScene()`).

- [ ] **Erase tiles individual**: CLI tiene `map erase` con `--rect` pero no permite borrar posiciones especificas. Agregar `--at x1,y1;x2,y2` como alternativa.

- [ ] **Layer delete**: No hay forma de eliminar un TileMapLayer de una escena. Agregar `godot_layer_remove` y CLI `map remove-layer`.

### P3 - Nice to have

- [ ] **npm publish prep**: Agregar `bin` shebang correcto, `files` en package.json, probar `npx godot-map-cli`.

- [ ] **Watch mode**: `map watch <scene>` que detecte cambios en el .tscn (Godot editando) y muestre diff en terminal.

- [ ] **Export a otros formatos**: `export --format phaser-json` o similar para usar el mapa fuera de Godot.

- [ ] **Tileset describe (AI)**: Usar el PNG del tileset para que Claude describa visualmente cada tile. Requiere enviar la imagen como parte del MCP response.

- [ ] **Multi-source TileSet**: Actualmente `createTileSet` solo crea un TileSetAtlasSource. Soportar multiples sources (multiples PNGs en un TileSet).

- [ ] **Undo/history**: Guardar snapshot antes de cada escritura para poder revertir.

---

## Decisions log

| Decision | Razon |
|---|---|
| Fork godot-tilemap-mcp en vez de godot-mcp | godot-tilemap-mcp ya tenia el decoder binario de PackedByteArray (la parte mas dificil). godot-mcp no tiene nada de tilemaps. |
| TypeScript en vez de JS puro | Type safety, mejor DX, mejor para mantener largo plazo. |
| Pure file I/O (no Godot runtime) para operaciones basicas | Mas rapido, no requiere Godot instalado para 90% de operaciones. Headless Godot solo para terrain resolution y screenshots. |
| commander.js para CLI | Simple, maduro, zero config. |
| Seeded RNG en generadores | Reproducibilidad: mismo seed = mismo mapa. Critico para que AI pueda iterar. |

---

## Dependencias del plan original vs implementado

```
Plan original                         Estado
------------------------------------------
Sprint 1: Foundation                  DONE
Sprint 2: TileSet management          PARCIAL (falta terrain config, collision CLI)
Sprint 3: TileMap editing             DONE
Sprint 4: Terrain painting            PARCIAL (GDScript generado, no testeado E2E)
Sprint 5: MCP server                  DONE (compila, falta testear con Claude)
Sprint 6: Generators + polish         PARCIAL (generators hechos, falta README y polish)
```
