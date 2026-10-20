---
name: SFM
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf2'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5efff'
  surface-container-high: '#dbe9ff'
  surface-container-highest: '#d4e4fa'
  on-surface: '#0d1c2d'
  on-surface-variant: '#45474c'
  inverse-surface: '#233143'
  inverse-on-surface: '#e9f1ff'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#001334'
  on-tertiary: '#ffffff'
  tertiary-container: '#00275b'
  on-tertiary-container: '#4c8dff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f8f9ff'
  on-background: '#0d1c2d'
  surface-variant: '#d4e4fa'
typography:
  h1:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-display:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  helper-text:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 24px
  gutter: 16px
---

## Brand & Style
This design system centers on **Trustworthy Industrial Precision**. It is designed for high-stakes utility management where clarity and rapid data interpretation are critical. The style is **Corporate-Modern** with a focus on high-fidelity data visualization. 

The aesthetic balances the utilitarian nature of industrial IoT with the refined polish of modern SaaS. It avoids unnecessary decorative elements, favoring structural integrity, clear information architecture, and a sense of "stability" that assures the operator that the system is functioning correctly.

## Colors
The palette is anchored by **Deep Slate Gray**, used for the sidebar and primary navigation to provide a solid, grounded frame for the application. 

- **Primary Accents**: Bright Cyan and Water Blue are used for interactive elements and "active" states, reflecting the fluid nature of the product.
- **Surface Strategy**: A very light gray background (#f8fafc) allows white cards to pop subtly.
- **Semantic Logic**: These colors are reserved strictly for status. Avoid using Green, Red, or Yellow for branding or non-critical UI elements to maintain the integrity of "at-a-glance" monitoring.

## Typography
This design system utilizes **Inter** for its neutral, highly legible characteristics. 

- **Data Hierarchy**: Numerical data points (flow rates, pressure, levels) use the `data-display` style to ensure they are the most prominent elements on the page.
- **Labels**: Small uppercase labels are used to categorize metadata and secondary metrics without cluttering the visual field.
- **Contrast**: Use Deep Slate Gray (#1e293b) for primary headings and body text to ensure maximum readability against white surfaces.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a standard 12-column structure for main dashboard views.

- **Dashboard Layout**: Content is housed within a fixed-width sidebar (260px) and a fluid main content area.
- **Spacing Rhythm**: A 4px baseline grid is used. Cards should typically have a padding of `lg` (24px) for desktop and `md` (16px) for mobile-responsive states.
- **Density**: Use "Comfortable" spacing for high-level monitoring and "Compact" spacing for deep-dive data tables and technical configuration screens.

## Elevation & Depth
This design system utilizes **Tonal Layers** and **Ambient Shadows** to create a structured hierarchy.

- **Z-Axis**: The background sits at `z-0`. Cards and primary containers sit at `z-1` with a subtle, soft shadow (0px 2px 4px rgba(30, 41, 59, 0.05)).
- **Interactive Elements**: Hover states for cards should slightly increase the shadow depth (0px 10px 15px rgba(30, 41, 59, 0.1)) to signify interactivity.
- **Separation**: Minimal borders (1px, #e2e8f0) are used instead of shadows for secondary groupings within a card, such as table headers or section dividers.

## Shapes
The shape language is consistently **Rounded**, communicating modern software standards while remaining professional.

- **Cards/Modules**: Use a radius of 12px for primary dashboard modules.
- **Buttons/Inputs**: Use a radius of 8px to maintain a crisp, clickable appearance.
- **Status Indicators**: Use "Pill" shapes for tags/chips and perfect circles for status "pips" next to device names.

## Components
- **Buttons**: Primary buttons use the Bright Cyan (#06b6d4) background with white text. Secondary buttons use a transparent background with a 1px border of Deep Slate Gray.
- **Cards**: All data modules are wrapped in white cards with 12px rounded corners and a 1px #e2e8f0 border. 
- **Status Chips**: Used for "Online," "Offline," or "Alert." Chips should use a 10% opacity version of the semantic color as the background and the 100% opacity color for the text and a small leading icon (e.g., a dot).
- **Data Visualizations**: Line charts for water flow should use Water Blue (#3b82f6) with a subtle gradient fill below the line. Critical thresholds should be marked with a dashed Red line.
- **Inputs**: Form fields use a white background, 8px radius, and a 1px #cbd5e1 border, turning Water Blue on focus.
- **Device Lists**: Use a clean, row-based layout with high vertical padding (16px) and a clear status pip at the start of each row.