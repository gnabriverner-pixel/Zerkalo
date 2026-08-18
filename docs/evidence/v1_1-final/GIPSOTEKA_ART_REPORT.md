# Zerkalo V1.1 — «Гипсотека» Planetary Emblem Art System Report

Generated: 2026-08-17
Design Source: Claude Design Canonical Artifact (\`Zerkalo Art Directions.dc.html\`)
Target Module: \`src/art/emblem/\`

---

## 1. Executive Summary & Design Rationale

In Zerkalo V1.1, the legacy animated visual system (which featured 90-second spinning SVG yantras, generic canvas pulse loops, and blurry halo glow effects) has been completely decommissioned and replaced by the **«Гипсотека» Planetary Emblem Art System**.

The system treats each planetary archetype as an architectural plaster bas-relief (*Alabaster Sanctuary*) or an inlaid precious metal emblem encased in dark volcanic glass (*Obsidian Mirror*).

### Core Principle: The Object is Still, Light is in Motion
Instead of rotating or pulsating the sacred symbol, the physical relief stays entirely static and weighted. A single directional raking light source (azimuth 135°, grazing angle 12°) moves subtly in response to user pointer navigation (±18° range, 900ms ease-out tracking), revealing the depth, bevels, and incisions of the carved stone.

---

## 2. Architecture & Components

The implementation lives cleanly in \`src/art/emblem/\`:

| File | Purpose | Key Specifications |
| :--- | :--- | :--- |
| \`geometry.tsx\` | Canonical SVG path definitions for all 9 planets (Sun through Mars). | Exact vector paths preserving \`ARCHETYPE_VISUALS\` semantics with dedicated gold accent highlights (\`#C8A45D\`). |
| \`EmblemDefs.tsx\` | Global SVG \`<defs>\` injecting tactile filters. | \`#zk-carve\` (Alabaster feDropShadow highlights/shadows) and \`#zk-deboss\` (Obsidian debossing). |
| \`EmblemPlate.tsx\` | Master React component for rendering Alabaster and Obsidian medallions. | Responsive sizing, JetBrains Mono numeral badge (\`0N\`), Cormorant Garamond typographic label. |
| \`useRakingLight.ts\` | Pointer tracking hook with smooth lerp physics. | Computes \`--zk-lx\` and \`--zk-ly\` CSS variables via \`requestAnimationFrame\`. Zero overhead when idle. |
| \`emblem.css\` | GPU-accelerated styling and entry reveal animations. | \`zk-rise\`, \`zk-sweep\`, \`zk-emerge\`, \`zk-spec\`, \`zk-reflect\`. |

---

## 3. Planetary Metrology & Material Specification

| Number | Planet | Sanskrit | Metal / Alloy | Alabaster Relief Signature | Obsidian Glass Signature |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | Солнце | Сурья | Латунь (\`#E8CE93\`) | Монолитная шахта: вертикальная фаска | Полированная латунь, блик в центре |
| **2** | Луна | Чандра | Серебро (\`#EAEEF5\`) | Гребни зеркальной воды, гаснущие по очереди | Двойное отражение, горизонтальная рябь |
| **3** | Юпитер | Гуру | Бронза (\`#E2B47C\`) | Купольная ротонда с 8 радиальными ребрами | Восемь лучей с круговой задержкой |
| **4** | Раху | Раху | Сталь (\`#BCC5D4\`) | Две плоскости под 45° в противофазе | Анодированная сталь, двойной блик |
| **5** | Меркурий | Будха | Никель (\`#E0E7EA\`) | Эллиптические орбиты разной глубины | Ртутный никель, быстрый эллиптический блик |
| **6** | Венера | Шукра | Розовая латунь (\`#EBC5B1\`) | Мягкая алебастровая складка драпировки | Розовая латунь, широкий мягкий градиент |
| **7** | Кету | Кету | Черненое серебро (\`#ADAFBA\`) | Обелиск с глубокой падающей тенью | Черненое серебро, графичный контур |
| **8** | Сатурн | Шани | Свинец (\`#A0A5AF\`) | Глубокая 4-уступная резьба по базальту | Свинец, полная монолитная неподвижность |
| **9** | Марс | Мангала | Каленая сталь (\`#D2D9E3\`) | Острая диагональная фаска 45° кованого лезвия | Каленая сталь, резкий режущий блик |

---

## 4. Performance, Mobile & Accessibility Verification

### 4.1. Zero Canvas / Pure CSS + SVG
- **Bundle Impact:** ~11 KB uncompressed SVG/CSS, 0 heavy WebGL/Three.js dependencies.
- **Render Costs:** Single DOM ref per plate; SVG filters are evaluated once on composite layer.

### 4.2. Mobile WebView Safety (390×844)
- Pointer move listener is automatically bypassed on \`(hover: none)\` devices.
- Light coordinates default to static \`--zk-lx: 0px\`, \`--zk-ly: 0px\`.
- Tap interaction triggers a single 1000ms sweep reveal without dragging or scroll stutter.

### 4.3. Accessibility & `prefers-reduced-motion`
- All animations (`zk-rise`, `zk-sweep`, `zk-spec`) immediately resolve to final static state when `prefers-reduced-motion: reduce` is detected.
- Light source locks to the canonical 135° azimuth.

---

## 5. Integration Points & Visual Evidence

1. **`src/App.tsx`**: `<EmblemDefs />` mounted at root container, ensuring SVG filters (`#zk-carve` and `#zk-deboss`) are globally available across routes.
2. **`src/components/ArchetypeBasRelief.tsx`**: Fully refactored to delegate to `<EmblemPlate variant="alabaster" />`.
3. **`src/components/Orb.tsx`**: Refactored to delegate to `<EmblemPlate variant="obsidian" />`.
4. **`src/components/PersonalMyth.tsx`**: Steps 0, 1–4, 5, and 6 render clean Alabaster plates with responsive scale.
5. **`src/components/MeetingOfMirrors.tsx`**: Renders the Obsidian Code medallion on the left and the Alabaster Myth medallion on the right.
6. **Mobile Touch & Specular Tap**: Alabaster plates trigger specular sweep on tap via `handleTap` and key reset.

### Visual Evidence Artifacts
- **Alabaster Medallion (`#zk-carve`):** `docs/evidence/v1_1-final/screenshots/03_gipsoteka_emblem_alabaster.png`
- **Obsidian Medallion (`#zk-deboss`):** `docs/evidence/v1_1-final/screenshots/04_gipsoteka_emblem_obsidian.png`
- **Reduced Motion Rendering:** `docs/evidence/v1_1-final/screenshots/12_reduced_motion_desktop.png`
