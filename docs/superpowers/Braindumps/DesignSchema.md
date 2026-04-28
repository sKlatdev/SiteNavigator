# Impeccable Design Schema: SiteNavigator

## 1. Vision & Philosophy
The SiteNavigator interface is designed as a "Soft Intelligence" platform. It balances the high-density requirements of security engineering with a sophisticated, glassmorphic aesthetic that reduces cognitive load during long research and configuration sessions.

## 2. Visual Language
### Glassmorphism & Depth
- **Surface Strategy:** Use a multi-layered approach with varying levels of background blur (12px to 24px) and translucent backgrounds (80% to 90% opacity).
- **Elevations:** 
  - **Level 1 (Base):** Deep obsidian background (#051424).
  - **Level 2 (Panels):** Translucent obsidian (#0d1c2d) with 1px border (#2c3a4c).
  - **Level 3 (Overlays/Modals):** Lighter translucent grey (#1e293b) with higher blur.

### Geometry & Softness
- **Radius:** A global `ROUND_EIGHT` (16px) radius is applied to all primary containers and cards to soften the technical nature of the content.
- **Buttons & Inputs:** Use a slightly tighter `ROUND_FOUR` (8px) for interactive elements to maintain a sense of precision within the softer framework.

### Typography
- **Primary Font:** Inter (Sans-serif) for high legibility across technical data.
- **Mono Font:** JetBrains Mono for code blocks and technical identifiers to provide clear differentiation.
- **Hierarchy:** Use semi-bold weights for section headers and subtle tracking increases on all-caps sub-labels to enhance scannability.

## 3. Color Architecture
- **Primary Accent:** Indigo Soft (#818cf8). Used for primary CTAs, active navigation states, and focus indicators.
- **Semantic Colors:**
  - **Success:** Emerald Soft (#34d399)
  - **Warning:** Amber Soft (#fbbf24)
  - **Critical:** Rose Soft (#fb7185)
- **Text:** 
  - **Primary:** Zinc 50 (90% contrast)
  - **Secondary:** Zinc 400 (60% contrast)
  - **Tertiary:** Zinc 500 (45% contrast)

## 4. Interaction Principles
- **Motion:** Transitions should be snappy (150ms-200ms) but use ease-in-out curves to feel fluid rather than robotic.
- **Feedback:** Use subtle scaling (98%) on button presses and soft border-glows on focus states.
- **Density:** Maintain a "Technical Grid" that allows for high data density while using generous internal padding (1.5rem+) within cards to prevent visual clutter.

## 5. Navigation & Shell
- **The Obsidian Shell:** A fixed-position sidebar navigation with integrated branding. It uses a deeper blur to ground the interface while the content area remains the primary focus.
- **Contextual Top Bar:** A slim, semi-transparent top bar for global search and utility actions, ensuring the user always has a high-level orientation.
