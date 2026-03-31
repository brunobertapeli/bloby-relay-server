# WebM to MOV Alpha Conversion Guide

**Do NOT use ffmpeg's `hevc_videotoolbox` directly for HEVC with alpha .mov files.** It produces corrupted output that won't play properly in Safari.

## Two-step process

### 1. WebM → ProRes 4444 intermediate
ffmpeg handles VP9 alpha decoding fine, just not HEVC alpha encoding:
```
ffmpeg -y -c:v libvpx-vp9 -i input.webm -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le /tmp/intermediate_prores.mov
```

### 2. ProRes 4444 → HEVC with alpha
Use Apple's `avconvert` (built into macOS):
```
avconvert -s /tmp/intermediate_prores.mov -o output.mov -p PresetHEVCHighestQualityWithAlpha --replace --progress
```

### 3. Clean up
Delete the intermediate ProRes file — they're large (~25-75MB).

## Context
- The `.webm` files use VP9 with `alpha_mode=1` (yuva420p) for transparency
- Chrome plays `.webm` with transparency natively
- Safari/other browsers show a black background with `.webm`
- The `.mov` HEVC alpha files are the Safari fallback
- The app serves `.webm` to Chrome and `.mov` to everything else
