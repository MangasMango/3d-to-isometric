# 3dtoisometric

Blender-based batch generator that renders 3D models as isometric game
sprites for the ARPG project. No UI, no dependencies beyond Blender.

## Usage

```
# 1. drop models into models/  (subfolder = category, e.g. models/prop/barrel.glb)
# 2. run:
.\run.ps1
# 3. find sprites in output/
```

Output layout matches the game exactly:

```
output/<category>/<model>/<model>_<clip>/<DIR>/<model>_<clip>_<DIR>_<angle>_<frame>.png   (animated)
output/<category>/<model>/<DIR>/<model>_<DIR>_<angle>_0.png                                (static prop)
```

- 16 compass directions (E, NEE, NE, ... at 22.5 deg steps), camera pitch 47.4
  deg (matches the game's 128/174 diamond ratio)
- Animation clips embedded in the model are rendered as frame sequences
  (default 8 frames @ 8 fps); models without clips get one frame per direction
- Formats: `.glb`, `.gltf`, `.fbx`, `.obj`; animation-only files are skipped
- A `manifest.json` describing the batch is written to `output/`

## Options

Pass through run.ps1 after the script args:

```
.\run.ps1 --frames 6 --fps 8 --size 256 --pitch 47.4 --padding 0.15 --yaw 45 --dirs E,N,SE --models <path> --output <path>
```

| Flag | Meaning |
|---|---|
| `--fixed-frame U` | render all models at one world scale: the ortho frame covers U world units (0 = auto-fit each model). Matches the game's asset scale; `--fixed-frame 20` reproduces arpg-project sprite sizes for Kenney-scaled models. Lower = bigger sprites. |
| `--no-shadow` | skip the soft blob shadow under the model |
| `--shadow-scale F` | blob shadow radius multiplier (default 1.0) |
| `--texture <path>` | force a specific texture image (default: auto-detect) |

Textures found next to the model (or in `skins/` / `textures/` subfolders)
are applied automatically to untextured materials.

## Animated characters from separate animation files (Kenney-style packs)

Packs like `kenney_animated-characters-retro` ship the character and each
animation as separate FBX files. Use the `anims/` convention and everything
merges automatically during `.\run.ps1`:

```
models/
  playable character/
    characterMedium/
      characterMedium.fbx     <- character (any supported format)
      anims/
        idle.fbx              <- animation-only files, same skeleton
        run.fbx
        jump.fbx
```

The animations must use the same skeleton (bone names) as the character.
Output: `output/playable character/characterMedium_idle/E/characterMedium_idle_E_0.0_0.png` etc.

To instead bake character + animations into a single GLB:

```
.\merge.ps1 <character-file> <anims-folder> <out.glb>
```

## Notes

- Blender's FBX/GLTF importers sometimes produce materials with alpha 0
  (invisible in renders); the script clamps those to opaque automatically.
- Models are rendered as-is; use `--yaw` if a model faces the wrong way.

## License

Copyright (c) 2026 Stamatis Valis. This project is licensed under the
MIT License — see [LICENSE](LICENSE) for the full text
(`SPDX-License-Identifier: MIT`).

The bundled sample assets under `models/playable character/` are from
Kenney's *Animated Characters (Retro)* pack, licensed CC0 1.0 (public domain
dedication).
See https://kenney.nl for the original packs.
