# Letterboxd-Inspired Theme Documentation

This project uses a Tailwind CSS theme inspired by Letterboxd's design aesthetic. The theme provides a dark, modern interface with clean typography and consistent spacing.

## Color Palette

### Background Colors

- `bg-letterboxd-bg-primary` (#1a1d1f) - Main dark background
- `bg-letterboxd-bg-secondary` (#2a2d2f) - Slightly lighter background for cards/sections
- `bg-letterboxd-bg-tertiary` (#3a3d3f) - Even lighter for hover states

### Text Colors

- `text-letterboxd-text-primary` (#e0e0e0) - Main text color
- `text-letterboxd-text-secondary` (#a0a0a0) - Secondary text (labels, descriptions)
- `text-letterboxd-text-muted` (#808080) - Muted text (placeholders, disabled)

### Accent Colors

- `text-letterboxd-accent` (#42b883) - Letterboxd green for links and active states
- `text-letterboxd-accent-hover` (#3aa876) - Darker green for hover states
- `text-letterboxd-pro` (#f5c518) - PRO badge gold color

### Border Colors

- `border-letterboxd-border` (#404040) - Standard border color
- `border-letterboxd-border-light` (#505050) - Lighter border for subtle separators

## Typography

### Font Family

- Primary: Inter (Google Fonts)
- Fallbacks: Roboto, Arial, sans-serif

### Font Sizes

- `text-xs` - 0.75rem (12px)
- `text-sm` - 0.875rem (14px)
- `text-base` - 1rem (16px)
- `text-lg` - 1.125rem (18px)
- `text-xl` - 1.25rem (20px)
- `text-2xl` - 1.5rem (24px)
- `text-3xl` - 1.875rem (30px)
- `text-4xl` - 2.25rem (36px)

## Component Classes

### Buttons

- `.btn-primary` - Green accent button with hover effects
- `.btn-secondary` - Secondary button with border and hover effects

### Cards

- `.card` - Standard card with background, border, shadow, and rounded corners

### Form Elements

- `.input-field` - Styled input with focus states and proper spacing

### Typography

- `.section-title` - Uppercase section headers with proper spacing
- `.pro-badge` - Gold PRO badge styling

## Layout Patterns

### Header

```html
<header
  className="bg-letterboxd-bg-secondary border-b border-letterboxd-border px-6 py-4"
>
  <div className="max-w-7xl mx-auto flex justify-between items-center">
    <h1 className="text-2xl font-bold text-letterboxd-text-primary">Title</h1>
  </div>
</header>
```

### Main Content

```html
<main className="max-w-7xl mx-auto px-6 py-8">
  <!-- Content here -->
</main>
```

### Card Layout

```html
<div className="card">
  <h3 className="text-lg font-semibold text-letterboxd-text-primary mb-4">
    Card Title
  </h3>
  <!-- Card content -->
</div>
```

### Form Layout

```html
<div className="space-y-4">
  <div>
    <label
      className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
    >
      Label
    </label>
    <input className="input-field w-full" />
  </div>
</div>
```

## Animations

### Fade In

- `animate-fade-in` - Smooth fade in animation

### Slide Up

- `animate-slide-up` - Slide up from bottom with fade

## Shadows

- `shadow-letterboxd` - Standard card shadow
- `shadow-letterboxd-lg` - Larger shadow for elevated elements

## Responsive Design

The theme uses Tailwind's responsive prefixes:

- `sm:` - Small screens (640px+)
- `md:` - Medium screens (768px+)
- `lg:` - Large screens (1024px+)
- `xl:` - Extra large screens (1280px+)

## Usage Examples

### Authentication Form

```html
<div
  className="min-h-screen bg-letterboxd-bg-primary flex items-center justify-center px-4"
>
  <div className="w-full max-w-md">
    <div className="card">
      <h2
        className="text-2xl font-semibold text-letterboxd-text-primary mb-6 text-center"
      >
        Login
      </h2>
      <form className="space-y-4">
        <!-- Form fields -->
        <button className="btn-primary w-full">Submit</button>
      </form>
    </div>
  </div>
</div>
```

### Data Display

```html
<div className="card">
  <h3 className="text-lg font-semibold text-letterboxd-text-primary mb-4">
    Results
  </h3>
  <div
    className="bg-letterboxd-bg-primary rounded-lg p-4 overflow-auto max-h-96"
  >
    <pre className="text-sm text-letterboxd-text-secondary whitespace-pre-wrap">
      <!-- Data here -->
    </pre>
  </div>
</div>
```

## Best Practices

1. **Consistent Spacing**: Use Tailwind's spacing scale (4, 6, 8, 12, 16, etc.)
2. **Color Hierarchy**: Use primary text for headings, secondary for labels, muted for placeholders
3. **Interactive States**: Always include hover and focus states for interactive elements
4. **Accessibility**: Ensure sufficient color contrast and proper focus indicators
5. **Responsive**: Design mobile-first and use responsive utilities for larger screens
