# Wax Clean Plane Cuts — Design

**Date:** 2026-07-23  
**Status:** Approved

## Problem

Wax chips (`AppleWax_*` in `apple_c1.glb`) were created by selecting faces on a grid mesh. Diagonal boundaries follow existing face edges, so they look like staircases instead of straight/diagonal lines.

## Goal

Irregular shard-shaped wax chips whose shared borders are **real planar cuts** (clean straight/diagonal edges), not face-selection stairs.

## Approach

1. Keep the intact hidden `AppleWax` mesh as the source.
2. Delete existing staircased `AppleWax_*` chips.
3. Recursively bisect duplicates of `AppleWax` with angled planes (`bmesh.ops.bisect_plane` with fill) until ~24–28 shards exist.
4. Name chips `AppleWax_00` …, assign `AppleWaxMat`, hide source `AppleWax`.
5. Export `wack/public/models/apple_c1.glb` (apple body + stem + leaf + new chips).

## App impact

None. `Apple.jsx` / `waxContact.js` already discover meshes by `WAX_SLICE_PREFIX` (`AppleWax_`) and break by rest-space top Y.

## Success criteria

- Chip borders in Blender are coplanar straight/diagonal lines (no staircase zigzags).
- Game still loads wax chips and snaps them under plate contact.
- Stem, leaf, and apple body unchanged.
