# Living portrait pipeline

## Feasibility audit

The source is a 1254 × 1254 pencil-textured portrait with a stationary camera and cleanly separated facial features. That makes local, feathered deformation a safer choice than full-frame image-to-video: it preserves identity, earrings, paper grain, clothing, and background lines. The left foreground lock also has enough contrast to support a hand-authored hair mask. Automatic MediaPipe and hair segmentation are intentionally not runtime dependencies; for one fixed, approved portrait, reviewed normalized landmarks are deterministic and avoid model/version drift.

The old implementation duplicated the complete image three times and clipped rectangular or polygonal pieces in CSS. It could not occlude the pupils during a blink or keep the hair root anchored. It has been removed.

## Animation and prototype

`tools/generate_portrait.py` renders 270 frames at 30 fps. The generator decodes the PNG embedded in the text-based SVG directly into memory. Every frame begins as an exact copy of that source, then composites only feathered local flow fields:

| Time | Motion |
| --- | --- |
| 0.00–2.00 s | Still |
| 2.00–2.22 s | Curved upper-lid blink, slight lower-lid response |
| 2.22–3.22 s | Still |
| 3.22–3.72 s | Asymmetric mouth-corner and cheek lift |
| 3.72–6.72 s | Still |
| 6.72–7.65 s | Root-anchored foreground hair movement |
| 7.65–9.00 s | Still, identical to the opening frame |

Install and render:

```sh
python3 -m pip install -r requirements-animation.txt
python3 tools/generate_portrait.py --prototype
```

The command creates production `marina-loop.webm` and `marina-loop.mp4` files plus a smaller `marina-preview.mp4` review encode. FFmpeg must be available on `PATH`. Use `--keep-frames` to retain PNG frames for mask inspection.

## Site integration

The repository deliberately retains the text-based SVG rather than adding a binary PNG that text-only patch systems cannot transport. The homepage keeps that exact poster visible while media loads and fades the video in only after `canplay`. If an encode is absent, unsupported, blocked from autoplay, or fails to load, the poster stays visible. Reduced-motion visitors never receive video source URLs and always see the static portrait. The portrait remains the link to the test page and retains its keyboard focus treatment.
