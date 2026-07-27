# Wax Clean Plane Cuts Implementation Plan

> **For agentic workers:** Execute inline in this session (Blender MCP). Checkbox steps for tracking.

**Goal:** Replace staircased `AppleWax_*` face-selection chips with irregular shards cut by real planes.

**Architecture:** Blender-only mesh rebuild from hidden `AppleWax`, then re-export GLB. No JS changes.

**Tech Stack:** Blender Python (`bmesh.ops.bisect_plane`), BlendMCP, glTF export

## Global Constraints

- Keep mesh names starting with `AppleWax_` so `WAX_SLICE_PREFIX` still matches.
- Keep material `AppleWaxMat`.
- Do not modify `AppleBody`, `AppleStem`, `AppleLeaf`.
- Overwrite `wack/public/models/apple_c1.glb`.
- Do not commit unless the user asks.

---

### Task 1: Delete old chips and bisect new shards

**Files:**
- Modify: Blender scene (live)
- Produce: `AppleWax_00` … shards with planar cut faces

- [x] **Step 1: Delete all objects named `AppleWax_*`**
- [x] **Step 2: Duplicate `AppleWax` into a working mesh; unhide for processing**
- [x] **Step 3: Recursively bisect with random angled planes (~27 cuts → ~28 pieces), fill cut faces**
- [x] **Step 4: Rename pieces `AppleWax_00`…, assign `AppleWaxMat`, hide source `AppleWax`**
- [x] **Step 5: Verified planar cut caps (e.g. 22-vert face, ~1e-7 plane deviation) + new cut verts**

### Task 2: Export and smoke-check in app

**Files:**
- Overwrite: `wack/public/models/apple_c1.glb`

- [x] **Step 1: Export selected apple parts (body, stem, leaf, wax chips) as GLB**
- [ ] **Step 2: Confirm in browser — hard refresh; wax borders should read as clean diagonals**
