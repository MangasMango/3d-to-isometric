# Merges animation-only FBX/GLB files onto a character and exports one GLB
# with embedded clips (for packs like Kenney's where animations are separate).
# Usage: .\merge.ps1 <character-file> <anims-folder> <out.glb>
param(
    [Parameter(Mandatory = $true)][string]$Character,
    [Parameter(Mandatory = $true)][string]$Anims,
    [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$blender = Get-ChildItem "C:\Program Files\Blender Foundation\*\blender.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [version]($_.Directory.Name -replace 'Blender ', '') } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $blender) { Write-Error "Blender not found in C:\Program Files\Blender Foundation"; exit 1 }

& $blender --background --python (Join-Path $here 'merge_anims.py') -- --character $Character --anims $Anims --out $Out
