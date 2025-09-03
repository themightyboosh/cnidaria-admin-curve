## Critique 1 — End-to-End Curve Processing Pipeline (API → Matrix → Render)

Date: 2025-09-03

---

## Executive summary

The current system splits coordinate processing across two paradigms: API-driven processing for the real-time grid/3D views and WebGPU-driven processing for PNG export (and a separate `WorldView`). This causes redundant computation, inconsistent data shapes, and leaves GPU capacity underutilized for the interactive grid. Several fields returned by the API and noise metadata are unused on the client, leaving optimization levers idle. There are also API URL inconsistencies across modules.

Key opportunities:
- Unify all coordinate processing via WebGPU and/or normalize server responses for a consistent client-side path.
- Use the API and noise metadata already being returned (seed, cpuLoadLevel, category, curve-height, etc.).
- Standardize API URLs to a single environment-aware source of truth.

---

## My journey through the codebase

1) API and environment configuration
- `src/config/environments.ts` exposes `env.apiUrl` (dev: `https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`).
- Several modules bypass `env.apiUrl` and hardcode different URLs.
  - `src/services/curveDataService.ts` uses `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api`.
  - `src/services/visibleRectanglesService.ts` uses `https://us-central1-cnidaria-dev.cloudfunctions.net/cnidaria-api-dev`.
  - `src/pages/WorldView/index.tsx` uses `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api`.

2) Curve and noise loading
- Curves are fetched and normalized in multiple places, notably `CurveBuilder` and `WorldView`.
  - `CurveBuilder/index.tsx` cleans `curve-tags` and migrates `curve-type → coordinate-noise`.
  - `WorldView/index.tsx` fetches curves and coordinate-noise into local state.
- Coordinate noise patterns fetched from:
  - `/api/coordinate-noise` or `/api/coordinate-noise/firebase` (both used in different places).
- Noise metadata includes `gpuExpression`, `cpuLoadLevel`, `category`, `gpuDescription`, but only `gpuExpression` is consistently used.

3) Real-time grid path (API-driven)
- Entry points:
  - `src/pages/CurveBuilder/DynamicSVGGrid.tsx` renders the 128×128 visible grid as SVG rectangles via a service.
  - `src/pages/CurveBuilder/ThreeJSGrid.tsx` renders a dense 3D surface using a 128×128 data grid with interpolation.
- Data fetch:
  - `src/services/visibleRectanglesService.ts` calls `GET {api}/api/curves/{curveId}/process?x&y&x2&y2` for the viewport bounds and updates an internal Map of rectangles.
  - `src/services/curveDataService.ts` also calls `GET {api}/api/curves/{curveId}/process?x&y&x2&y2` and stores results in `localDataArray`.
- Rendering:
  - SVG path: `DynamicSVGGrid` reads from `visibleRectanglesService` and draws rectangles only if coordinate data exists. If a rectangle lacks data, it is not drawn. Colors are grayscale and may fallback to random if index/value is missing.
  - 3D path: `ThreeJSGrid` fetches the same API data, builds height and color maps, then applies bilinear interpolation for a 640×640 vertex mesh.

4) WebGPU path (export/PNG and separate WorldView)
- `src/services/webgpuService.ts` orchestrates:
  - Coordinate processing → matrix sort → image generation.
  - `src/utils/webgpuCoordinateNoise.ts` (compute pipeline for coordinates/values)
  - `src/utils/webgpuMatrixSort.ts` (sorting)
  - `src/utils/webgpuImageGeneration.ts` (compute pipeline for final RGBA + value plane)
- Default sizes are typically 512×512 for export; measured performance is near-real-time locally.
- `src/pages/WorldView/index.tsx` also uses a bespoke WGSL compute approach (instancing/terrain) that is separate from the 2D grid code and from the export pipeline.

---

## Pipeline, step by step (observed)

1) Load curve list and noise patterns
- Curves: `GET {api}/api/curves` → array with fields like `curve-data`, `curve-width`, `curve-index-scaling`, optionally `curve-height`, `coordinate-noise`, etc.
- Noise: `GET {api}/api/coordinate-noise` or `.../firebase` → metadata including `gpuExpression`, `cpuLoadLevel`, `category`, `gpuDescription`.

2) Choose a curve and determine viewport
- The UI selects a curve. Grid views compute viewport bounds (usually ±64 each axis for 128×128) and may add buffer.

3a) Real-time grid: request processed coordinates from API
- The client calls `GET {api}/api/curves/{curveId}/process?x={minX}&y={minY}&x2={maxX}&y2={maxY}`.
- Response shapes diverge across modules:
  - In `curveDataService.ts`: expected `{ [curveName]: ProcessCoordinateResponse[] }` where each item has `cell-coordinates`, `index-position`, `index-value`.
  - In `visibleRectanglesService.ts`: expected `{ [curveName]: { ["x,y"]: { value, index } } }` to map directly by coordinate key.
- The data is stored in per-module caches and then rendered:
  - SVG: squares drawn only for cells with data; grayscale color derived from value or index.
  - 3D: heights/colors interpolated across a denser mesh for smooth terrain.

3b) Export/PNG: compute everything on the GPU
- `webgpuService.processCompleteImage(...)`:
  - Stage 1: GPU coordinate/value compute from `gpuExpression`, curve width, index scaling, center/scale.
  - Stage 2: GPU matrix sort (by distance), optional.
  - Stage 3: GPU image generation → packed RGBA and value plane.
- The result is a 512×512 (configurable) image produced quickly without hitting the API for per-cell values.

4) WorldView (separate GPU compute path)
- `WorldView/index.tsx` compiles WGSL and pushes per-chunk instancing with uniforms including curve width/height/index scaling and a noise seed. This is logically a third path distinct from both the API-grid and the export pipeline.

---

## What the API/noise provides vs what the client uses

Provided by curve API (observed across code and typical payloads):
- Used consistently:
  - `curve-data` (Uint8 0–255 values)
  - `curve-width`
  - `curve-index-scaling`
  - `coordinate-noise` (as a name to look up `gpuExpression`)
- Underused or unused on the client:
  - `curve-height` (client-side logic often assumes 255; WebGPU shaders and `WorldView` pass a uniform but CPU pipeline uses a constant)
  - any seed field (e.g., `coordinate-noise-seed`): present in types but not wired through most client paths
  - legacy/migration fields (e.g., `curve-type` unless migrated at load time)

Provided by coordinate-noise API:
- Used consistently:
  - `gpuExpression` to drive WebGPU compute and to build CPU fallback noise functions
- Unused client-side (but present and useful):
  - `cpuLoadLevel` (could inform scheduling or progressive refinement)
  - `category` (organization; could drive UX filtering or presets)
  - `gpuDescription` (could enhance UI/insights)

Per-cell process API (grid):
- Returns precomputed values/indexes per coordinate. Client treats it as authoritative for the grid view.
- Mixed response shapes expected in different modules (array vs object map), increasing coupling to endpoints rather than a single normalized client model.

---

## Disconnections and inconsistencies

1) Dual (actually triple) pipelines for the same conceptual work
- Grid (2D): API computes cell values → client renders.
- Export (PNG): Client GPU computes everything → image.
- WorldView (3D/GPU): Separate WGSL path renders chunks.
Impact: Redundant computation paths; higher maintenance burden; potential for subtle mismatches.

2) API URL fragmentation
- Different modules use different base URLs and sometimes skip the `/api` prefix:
  - `curveDataService.ts`: `.../cnidaria-api`
  - `visibleRectanglesService.ts`: `.../cnidaria-api-dev`
  - `WorldView/index.tsx`: `.../cnidaria-api`
  - `ThreeJSGrid.tsx`: concatenates `apiUrl` but calls `${apiUrl}/curves/...` (missing `/api`), unlike others that use `${apiUrl}/api/curves/...`.
Impact: Environment drift, inconsistent behavior, and hard-to-debug failures.

3) Response shape drift between modules
- `curveDataService` expects an array of `{ cell-coordinates, index-position, index-value }`.
- `visibleRectanglesService` updates from a map `{ ["x,y"]: { value, index } }`.
Impact: Tight coupling to endpoint shapes; difficult to swap sources; duplication of mapping logic.

4) Unused or underused fields
- `curve-height`: client CPU logic uses a constant 255 (`CONFIG.CURVE_HEIGHT`) rather than curve-specific height.
- `seed`-like fields: defined in types and WGSL uniforms but not consistently set from curve/noise to client GPU/CPU paths.
- Noise metadata (`cpuLoadLevel`, `category`, `gpuDescription`) not leveraged beyond display in some lists.
Impact: Lost expressiveness and optimization opportunities; mismatched visuals if curves expect non-255 heights.

5) Cache fragmentation
- `visibleRectanglesService` keeps its own Map keyed by world coordinates.
- `curveDataService` maintains a separate `localDataArray` Map.
- 3D grid constructs its own height/index maps per fetch cycle.
Impact: Memory overhead; no shared invalidation; repeated work when switching views.

6) Coordinate fill semantics and visual clarity
- SVG grid renders only cells with data; if missing, cells are not drawn at all (or colors may be random when using other services).
Impact: Users can’t easily distinguish real vs placeholder/absent data; the grid can look sparse or misleading.

---

## Performance observations (relative)

- API 128×128 area: hundreds of milliseconds (network + server compute + client render).
- Client WebGPU 512×512 compute+image: tens to ~100ms in typical desktop GPUs.
- WorldView GPU path: real-time, but separate from the 2D grid/export pipelines.

Conclusion: WebGPU can service the interactive grid at larger sizes with better latency than the current API-per-cell-path, if unified.

---

## Recommendations

1) Unify around a single processing engine
- Prefer WebGPU for interactive grid, 3D, and PNG generation to ensure one source of truth.
- If server-side compute remains needed, standardize the response shape to match the local model the client uses.

2) Standardize `apiUrl` usage
- Route all network requests through `env.apiUrl`.
- Fix path prefixes so all requests use `${apiUrl}/api/...` consistently.

3) Normalize response shape client-side
- Define a single TypeScript model for coordinate results (keyed by `x,y` or normalized array) and convert all endpoint responses to it immediately at the boundary.
- Expose one shared in-memory cache that all views can consume.

4) Use existing API data fully
- Respect `curve-height` (and fall back only if missing).
- Thread any curve/noise seed into CPU and GPU pipelines for deterministic results.
- Leverage `cpuLoadLevel` for progressive loading or prioritization when precomputing/chunking.
- Use `category` and `gpuDescription` for UX clarity and discoverability.

5) Clarify grid fill semantics
- Decide: render absent data as empty, or synthesize placeholders with a distinct style so users can tell the difference.

6) Converge 3D and 2D compute
- Reuse the same WebGPU coordinate/value computation and share buffers/results between 2D, 3D, and export.

---

## Suggested near-term tasks (high impact)

- Consolidate all API requests to `env.apiUrl` and fix any missing `/api` path segments.
- Introduce a `CoordinateResult` canonical model and a single `CoordinateCache` shared module.
- Use `curve-height` in CPU math (replace `CONFIG.CURVE_HEIGHT = 255` with the curve’s actual value when present).
- Thread a seed from curve/noise into both CPU and GPU paths.
- Replace API-per-cell grid with WebGPU-backed compute for interactive views; fall back to API only where required.

---

## Closing note

Individually, the components are strong. The main opportunity is architectural: unify processing, standardize inputs/outputs, and use the rich API/noise metadata you already have. Doing so will remove duplicated logic, improve performance dramatically, and reduce debugging complexity.


