# Beamer Presentation

This directory contains the LaTeX Beamer presentation for the HCMIU Map Collaborative project.

## Files

| File | Description |
|------|-------------|
| `main.tex` | Full presentation with **presenter notes** (40 pages: 20 slides + 20 note pages) |
| `main.pdf` | Compiled PDF of `main.tex` |
| `slides-only.tex` | Slides-only version **without** presenter notes (20 pages) |
| `slides-only.pdf` | Compiled PDF of `slides-only.tex` |

## Duration

The presentation is designed for approximately **8 minutes** (roughly 25–30 seconds per slide).

## Presenter Notes

Presenter notes are included in `main.tex` via `\note{...}` commands. To display them:

- **Dual-screen presentation:** Uncomment `\setbeameroption{show notes on second screen=right}` in `main.tex`
- **Printed notes:** The default `main.pdf` shows notes below each slide
- **Slides only:** Use `slides-only.pdf` for projection

## Building

```bash
cd presentation
pdflatex main.tex && pdflatex main.tex          # Two passes for cross-references
pdflatex slides-only.tex && pdflatex slides-only.tex
```

Requires: `texlive-latex-base`, `texlive-latex-recommended`, `texlive-latex-extra`, `texlive-fonts-recommended`

## Slide Overview

1. **Title** — Project name, author, course
2. **Outline** — Table of contents
3. **Problem Context** — Schema variability, relationship density, multi-model motivation
4. **Project Objectives** — Five concrete goals
5. **System Architecture** — Three-tier diagram with WebSocket
6. **Database Design** — Document & edge collections, multi-model advantages
7. **AQL Queries** — Graph traversal, shortest path, full-text search
8. **Landing Page** — Screenshot with feature overview
9. **Interactive Map** — Screenshot of 7-floor campus map
10. **Pathfinding** — BFS shortest path & Held–Karp TSP
11. **Collaborative Graph** — Screenshot of entity discussions
12. **Trial System** — State diagram of court workflow
13. **Research Tools** — Reference, full-text, degree, mention
14. **WebSocket** — Real-time event types and design
15. **Tech Stack & Testing** — Technology table + test coverage
16. **Benchmark Throughput** — Stress-test throughput chart
17. **Benchmark Latency** — Stress-test latency percentile chart
18. **Conclusions** — Key contributions and future work
19. **References** — Academic citations
20. **Thank You / Q&A** — Links to live demo and source code
