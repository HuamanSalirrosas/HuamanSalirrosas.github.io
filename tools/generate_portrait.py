#!/usr/bin/env python3
"""Render Marina's restrained nine-second living-portrait loop.

The deformation is deliberately local: every frame starts from the original pixels,
then only feathered eye, cheek/mouth, and foreground-hair masks are composited.
Run from the repository root after installing requirements-animation.txt.
"""
from __future__ import annotations

import argparse
import base64
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np

FPS = 30
DURATION = 9.0
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/marina-portrait.svg"
OUTPUT = ROOT / "assets/portrait"


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def pulse(t: float, start: float, peak: float, end: float) -> float:
    if not start < peak < end or t <= start or t >= end:
        return 0.0
    if t < peak:
        return smoothstep((t - start) / (peak - start))
    return 1.0 - smoothstep((t - peak) / (end - peak))


def feathered_polygon(shape: tuple[int, int], points: list[tuple[float, float]], blur: int) -> np.ndarray:
    h, w = shape
    mask = np.zeros((h, w), np.uint8)
    scaled = np.array([(round(x * w), round(y * h)) for x, y in points], np.int32)
    cv2.fillPoly(mask, [scaled], 255)
    return cv2.GaussianBlur(mask, (0, 0), blur)[:, :, None].astype(np.float32) / 255.0


def remap_region(image: np.ndarray, mask: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    grid_x, grid_y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    moved = cv2.remap(image, grid_x - dx, grid_y - dy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return np.clip(image * (1.0 - mask) + moved * mask, 0, 255).astype(np.uint8)


def blink(image: np.ndarray, amount: float) -> np.ndarray:
    """Close curved lids using vertical flow, never scaling a rectangular eye copy."""
    if amount <= 0:
        return image
    h, w = image.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    result = image
    for cx, cy, rx, ry in ((0.434, 0.313, 0.052, 0.029), (0.562, 0.313, 0.052, 0.029)):
        x0, y0, sx, sy = cx * w, cy * h, rx * w, ry * h
        normalized_x = (xx - x0) / sx
        curve = np.sqrt(np.maximum(0.0, 1.0 - normalized_x**2))
        influence = np.exp(-((xx - x0) / sx) ** 8 - ((yy - y0) / sy) ** 6)
        # Upper lid travels farther; the lower lid rises subtly.
        upper = np.maximum(0.0, y0 - yy) * (0.82 * amount) * curve
        lower = -np.maximum(0.0, yy - y0) * (0.22 * amount) * curve
        dy = ((upper + lower) * influence).astype(np.float32)
        mask = feathered_polygon((h, w), [
            (cx-rx*1.15, cy-ry*1.45), (cx+rx*1.15, cy-ry*1.45),
            (cx+rx*1.15, cy+ry*1.35), (cx-rx*1.15, cy+ry*1.35)], 4)
        result = remap_region(result, mask, np.zeros_like(dy), dy)
    return result


def expression(image: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0:
        return image
    h, w = image.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    # Lift the viewer-right mouth corner and its cheek with a broad radial falloff.
    cx, cy = 0.548 * w, 0.458 * h
    falloff = np.exp(-(((xx-cx)/(0.095*w))**2 + ((yy-cy)/(0.085*h))**2) * 2.2)
    dx = (1.4 * amount * falloff).astype(np.float32)
    dy = (-3.2 * amount * falloff).astype(np.float32)
    mask = feathered_polygon((h, w), [(0.47,.405),(.62,.405),(.62,.525),(.46,.525)], 10)
    return remap_region(image, mask, dx, dy)


def hair_breeze(image: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0:
        return image
    h, w = image.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    root_y = 0.17 * h
    travel = np.clip((yy-root_y)/(0.64*h), 0, 1)
    # Root stays anchored; tip movement and a tiny delayed curl feel wind-driven.
    dx = (-5.0 * amount * travel**1.7 + 1.2 * math.sin(amount*math.pi) * travel**2).astype(np.float32)
    dy = (-1.3 * amount * travel**2).astype(np.float32)
    mask = feathered_polygon((h, w), [(.245,.13),(.34,.14),(.315,.45),(.27,.65),(.21,.78),(.225,.34)], 9)
    return remap_region(image, mask, dx, dy)


def render_frame(source: np.ndarray, t: float) -> np.ndarray:
    # 0–2 still; 2–2.22 blink; 3.22–3.72 expression; 6.72–7.65 hair.
    frame = blink(source, pulse(t, 2.00, 2.11, 2.22))
    frame = expression(frame, pulse(t, 3.22, 3.47, 3.72))
    frame = hair_breeze(frame, pulse(t, 6.72, 7.12, 7.65))
    return frame


def encode(frames_dir: Path, output: Path, prototype: bool) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg is required to encode WebM/MP4.")
    common = [ffmpeg, "-y", "-framerate", str(FPS), "-i", str(frames_dir / "%04d.png"), "-an"]
    subprocess.run(common + ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-pix_fmt", "yuv420p", str(output / "marina-loop.webm")], check=True)
    subprocess.run(common + ["-c:v", "libx264", "-crf", "22", "-movflags", "+faststart", "-pix_fmt", "yuv420p", str(output / "marina-loop.mp4")], check=True)
    if prototype:
        subprocess.run(common + ["-vf", "scale=480:-2", "-c:v", "libx264", "-crf", "28", "-movflags", "+faststart", str(output / "marina-preview.mp4")], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prototype", action="store_true", help="also write a small review encode")
    parser.add_argument("--keep-frames", action="store_true")
    args = parser.parse_args()
    # The repository keeps the portrait as text-based SVG so text-only patch
    # systems do not need to transport a binary PNG. Decode its embedded PNG
    # directly into OpenCV memory without creating another source asset.
    svg = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"base64,([^\"]+)", svg)
    if not match:
        raise SystemExit(f"Could not find an embedded image in {SOURCE}")
    encoded = np.frombuffer(base64.b64decode(match.group(1)), dtype=np.uint8)
    source = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if source is None:
        raise SystemExit(f"Could not decode the embedded image in {SOURCE}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    frames = Path(tempfile.mkdtemp(prefix="marina-frames-"))
    try:
        for index in range(round(DURATION * FPS)):
            cv2.imwrite(str(frames / f"{index:04d}.png"), render_frame(source, index / FPS))
        encode(frames, OUTPUT, args.prototype)
    finally:
        if args.keep_frames:
            print(f"Frames retained at {frames}")
        else:
            shutil.rmtree(frames, ignore_errors=True)


if __name__ == "__main__":
    main()
