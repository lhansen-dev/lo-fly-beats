# Assets

| Asset | Kind | Source and license | Path |
|---|---|---|---|
| 3D listening room and fly | Original procedural geometry, materials, wood grain, notebook writing, and banana textures. Fly anatomy and dark coloring guided by the user's supplied visual reference; no external models, textures, or fonts. | Original project artwork; Three.js is MIT licensed. | `src/scene/three/flyModel.ts`, `src/scene/three/roomModel.ts`, `src/scene/three/geometry.ts`, `src/scene/three/runtime.ts`, `src/scene/Scene.tsx`, `src/scene/SceneFrame.tsx` |
| Listening room fallback | Still image captured from this project's 3D renderer. Used during loading and when WebGL is unavailable or its context is lost. | Original project artwork. | `public/images/listening-room.jpg` |
| Earlier scene SVG components | Original vector scene retained in the source tree. | Original project artwork. | `src/scene/fly/Fly.tsx`, `src/scene/layers/` |
| Audio | Drum (kick, snare, hat), rain, and crackle buffers generated in code; instruments from Tone synthesizers. No samples or recordings. | Generated in code; Tone synthesizers. | `src/audio/buffers.ts`, `src/audio/rig.ts` |
| Data | MaleCNS v1.0 files: `body-annotations-male-cns-v1.0-minconf-0.5.feather` and `connectome-weights-male-cns-v1.0-minconf-0.5.feather`. Licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Citation: Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999. Filtering rules: every neuron with status Traced, across all classes in the brain and ventral nerve cord; connections between selected bodies; self-connections removed; at least 3 synapses. No edge sampling or caps. | `public/data/circuits/whole-cns-v1/neurons.json.gzip`, `public/data/circuits/whole-cns-v1/adjacency.bin.gzip`, `public/data/circuits/whole-cns-v1/manifest.json`; previous `mbon-v1` data remains for regression checks. |
| Fonts | System fonts only; no font files. | System fonts. | None |

Update this file whenever an asset is added.

The listening room includes original 3D books, a plant, an analogue player, a mug, a notebook, a pencil, and a lamp in `src/scene/three/roomModel.ts`. Interface icons in `src/components/Icon.tsx` and the network visualization in `src/components/scanner/` use original SVG and canvas. The scanner uses the credited MaleCNS connectivity data above with a deterministic schematic layout; it contains no anatomical imagery. The overview plots every traced neuron, with representative background links; playback and highlighted paths use the complete retained graph. All typography continues to use system fonts.
