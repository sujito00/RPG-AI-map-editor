# Template for headless terrain resolution.
# The CLI fills in {{SCENE_PATH}}, {{LAYER_NAME}}, {{TERRAIN_SET}},
# {{TERRAIN}}, and {{COORDS_ARRAY}} before execution.

@tool
extends SceneTree

func _init():
	var scene = load("{{SCENE_PATH}}") as PackedScene
	if not scene:
		print("ERROR: Could not load scene: {{SCENE_PATH}}")
		quit(1)
		return

	var root = scene.instantiate()
	var layer: TileMapLayer = null

	for child in root.get_children():
		if child is TileMapLayer and child.name == "{{LAYER_NAME}}":
			layer = child as TileMapLayer
			break

	if not layer:
		print("ERROR: TileMapLayer '{{LAYER_NAME}}' not found")
		quit(1)
		return

	var coords: Array[Vector2i] = [{{COORDS_ARRAY}}]
	layer.set_cells_terrain_connect(coords, {{TERRAIN_SET}}, {{TERRAIN}})

	var packed = PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, "{{SCENE_PATH}}")
	print("OK: Terrain resolved for {{LAYER_NAME}}, %d cells" % coords.size())
	quit(0)
