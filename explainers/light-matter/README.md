# 光、物质与遥感

An interactive, animation-led explainer (in Chinese) of what actually happens when light is
reflected and refracted, from the electromagnetic field and driven electrons to QED path sums,
and why that physics underlies optical, thermal and microwave remote sensing.

It is a standalone page and does not interact with the handbook search app in this repository.

## Open it

- Double-click `light-matter-standalone.html` (single self-contained file, no server needed).
- Or open `index.html` through any static server, e.g. `python3 -m http.server` in this folder.
  `index.html` is written as an artifact page body (no `<!doctype>`/`<head>` wrapper), which
  browsers render fine but in quirks mode, so prefer the standalone file for local viewing.

Fonts load from Google Fonts when online; without network the page falls back to system CJK fonts.

## Contents

| Ch. | Topic | Figures |
| --- | --- | --- |
| 0 | Zoom from a 10 m pixel to an electron | hero |
| 1 | Light as a self-sustaining EM wave; photon energy across the spectrum | 1 |
| 2 | Lorentz oscillator, dipole radiation, n(ω) and κ(ω) | 2 |
| 3 | Refraction as phase lag from secondary waves; Snell's law, TIR, evanescent wave | 3, 4 |
| 4 | Reflection from atomic wavelets, diffraction orders; Brewster angle from the dipole pattern | 5, 6 |
| 5 | Feynman's arrows over mirror paths; partial reflection by a glass sheet; InSAR | 7, 8 |
| 6 | Roughness relative to wavelength (Rayleigh criterion), phasor random walk | 9 |
| 7 | Monte Carlo photons in a leaf; reflectance spectra and Sentinel-2 bands; false-colour composite | 10–12 |
| 8 | IR activity of molecular vibrations; Planck curves and atmospheric windows | 13, 14 |
| 9 | Debye relaxation of water; soil moisture → emissivity → brightness temperature; SAR scattering | 15–17 |
| 10 | Sun → atmosphere → surface → sensor; summary table | 18 |

Waves, Fresnel coefficients, the Lorentz and Debye models and Planck curves are computed from
the standard formulas. Land-cover spectra, leaf optical parameters, atmospheric transmittance and
signal budgets are typical-magnitude approximations for illustration.

## Files

- `index.html` – page markup, text and styles
- `js/core.js` – shared helpers (SVG builders, animation loop, colour science, Fresnel/Planck)
- `js/hero.js`, `js/ch*.js` – one script per chapter
- `build.js` – inlines the scripts into `light-matter-standalone.html`

After editing, rebuild the standalone file:

```bash
node explainers/light-matter/build.js
```
