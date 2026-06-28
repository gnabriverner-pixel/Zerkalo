# Zerkalo Design System Spec

This specification defines the premium style tokens (colors, typography, spacing, and glassmorphism parameters) for the `zerkalo-workspace` frontend.

## Color Palette

### 1. Luxury Dark Theme (Personal Myth)
- **Background**: `#090706` (Curated rich black)
- **Gradients**: `linear-gradient(180deg, #0A0D0B 0%, #030403 100%)` (Deep pine/obsidian gradient)
- **Surface**: `rgba(255, 255, 255, 0.015)` (Semi-transparent glassmorphic container)
- **Surface Border**: `rgba(255, 255, 255, 0.06)` (Ultra-thin crisp borders)
- **Gold/Accent**: `#DCB059` (Warm antique gold)
- **Gold Glow**: `rgba(220, 176, 89, 0.12)` (Soft warm glow)
- **Text Primary**: `#F3EFE0` (Ivory/warm white)
- **Text Muted**: `#8E8A82` (Warm charcoal gray)
- **Divider Line**: `rgba(255, 255, 255, 0.08)`

### 2. Luxury Light Theme (Code Architecture)
- **Background (Marble)**: `#F8F5EF` with subtle structural noise overlay
- **Warm Paper**: `#F4EFE6`
- **Ink**: `#171717` (High-contrast obsidian ink)
- **Gold/Accent**: `#C8A45D` (Brushed brass gold)
- **Border**: `rgba(42, 41, 39, 0.12)`
- **Shadow**: `0 24px 80px rgba(30, 25, 18, 0.08)` (Luxury deep shadow)

## Typography

- **Serif (Headings, stories, numbers)**: `Cormorant Garamond, Georgia, serif`
  - *Weights*: `400 (Regular)`, `600 (Semibold)`
  - *Character*: High contrast, elegant, classical, and literary.
- **Sans-Serif (Controls, tags, minor labels)**: `Inter, system-ui, sans-serif`
  - *Weights*: `400 (Regular)`, `500 (Medium)`, `600 (Semibold)`
  - *Character*: Clean, low-key, readable, and technical.

## Micro-Animations
- **Hover Scale**: `scale(1.02)` with `cubic-bezier(0.16, 1, 0.3, 1)` spring curves.
- **Active Click**: `scale(0.98)`.
- **Transitions**: Global fade-in transitions for step updates using Framer Motion (AnimatePresence) set to `duration: 0.8s` with ease-out.
