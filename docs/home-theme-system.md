# Homepage Theme System

Homepage themes are registered from one central file:

`lib/home-theme-registry.ts`

## How The System Works

Each theme has two layers:

- A registered theme definition in `lib/home-theme-registry.ts`.
- A layout renderer in `app/page.tsx`.

The admin panel reads the same registry, so new themes automatically appear as selectable homepage systems with preview cards, activation controls, dedicated customization pages, reset controls, editable copy fields, upload fields, and preview links.

## Add a Theme Using an Existing Layout

Add one item to `homeThemeRegistry`:

```ts
{
  id: 'theme-3',
  layout: 'classic-academic',
  family: 'Sales-focused course catalog',
  adminSummary: 'Best for campaign landing pages, offers, and fast purchase decisions.',
  structure: ['Search hero', 'Category rail', 'Featured deals', 'Social proof'],
  preview: {
    hero: 'Search-first catalog hero',
    sections: ['Search', 'Deals', 'Categories'],
    accent: '#1D9BF0'
  },
  defaults: {
    name: 'Theme 3 - Sales Focus',
    description: 'A homepage tuned for offers and fast course purchase decisions.',
    heroTitle: 'Your custom hero title',
    heroSubtitle: 'Your custom hero subtitle.',
    primaryCtaLabel: 'Browse deals',
    primaryCtaUrl: '/courses',
    secondaryCtaLabel: 'Preview',
    secondaryCtaUrl: '/courses',
    featuredTitle: 'Featured deals',
    featuredSubtitle: 'Custom featured section copy.',
    panelTitle: 'Recommended start',
    panelSubtitle: 'Custom panel copy.',
    searchPlaceholder: 'Search courses...',
    recommendedTitle: 'Recommended start',
    recommendedSubtitle: 'Custom recommendation copy.',
    accentColor: '#1D9BF0',
    accentStrongColor: '#1A8CD8',
    accentSoftColor: 'rgba(29, 155, 240, 0.14)',
    backgroundColor: '#000000',
    surfaceColor: '#050505',
    surfaceAltColor: '#16181C',
    textColor: '#FFFFFF',
    mutedTextColor: '#71767B',
    borderColor: '#2F3336',
    buttonTextColor: '#FFFFFF',
    heroImageUrl: '',
    heroImageAlt: '',
    heroOverlayColor: 'rgba(0, 0, 0, 0.5)',
    heroOverlayOpacity: '0.5',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontDisplay: "'Inter', ui-sans-serif, system-ui, sans-serif",
    radius: '9999px',
    radiusCard: '16px',
    shadow: 'none'
  }
}
```

The new theme will automatically appear in:

- Admin theme selector
- Dedicated admin customization page at `/admin/theme/[theme-id]`
- Preview links
- Save and reset actions
- Homepage rendering

## Supported Layouts

Current layouts:

- `modern-minimal`
- `bold-vibrant`
- `classic-academic`
- `dark-tech`
- `editorial-magazine`
- `glass-pastel`
- `learnova-default`

## Included Premium Themes

- `theme-1`: Modern/Minimal. A crisp enterprise editorial surface with whitespace, hairline grids, premium course cards, and calm marketplace conversion.
- `theme-2`: Bold & Vibrant. A kinetic launch-studio homepage with oversized display typography, angled energy, glass search, vivid accents, and high-impact CTAs.
- `theme-3`: Classic Academic. A warm institutional library style with formal serif hierarchy, scholarly panels, testimonial trust, and structured program framing.
- `theme-4`: Dark Tech. A developer-console experience with technical grid depth, luminous cyan states, terminal-style signals, and course telemetry.
- `theme-5`: Editorial Magazine. A print-inspired premium magazine layout with masthead rhythm, rule lines, article surfaces, drop-cap content, and curated reading lists.
- `theme-6`: Glass Pastel. A polished soft-glass visual system with layered translucent panels, pastel gradients, stronger contrast, and lifestyle-friendly course discovery.
- `theme-7`: Original Default. The original Learnova dark marketplace homepage as a selectable theme, so admins can switch to other systems and return to the default look at any time.

Each bundled theme includes a distinct homepage renderer, default tokens, admin preview miniature, preview URL support, localized fallback copy, and editable visual controls. The theme refresh is intentionally implemented as a layered system: registered default tokens in `lib/home-theme-registry.ts`, renderer-specific markup in `components/themes/*`, and layout-level premium polish in `app/globals.css` behind `data-home-theme-layout`.

## Add a New Layout Type

If the new theme needs a different structure, add a layout renderer in `components/themes`, import it in `app/page.tsx`, then add a conditional renderer for the new `layout` value.

The admin panel and API will still work automatically as long as the theme is registered in `lib/home-theme-registry.ts`.

Run `npm run themes:check` after adding or editing a homepage theme. The check verifies unique theme IDs, complete default fields, localized fallback coverage, renderer mappings, smoke-test coverage, and documentation coverage.

Run `npm run themes:visual-check` against a running local or hosted demo to verify the rendered themes in a real browser:

```bash
BASE_URL=http://127.0.0.1:3000 npm run themes:visual-check
```

The visual check opens all seven `/?previewTheme=theme-id` pages at desktop and mobile viewport sizes. It fails if a theme has horizontal overflow, a missing hero title, a missing primary CTA, an incorrect `data-home-theme-layout`, or a broken first hero section. The final CodeCanyon gate starts a local production server and runs this check automatically after `npm run demo:build`.

## Admin Controls

Admin users can open `/admin/theme` to:

- Choose the active homepage theme system.
- Activate a theme directly from its card.
- Open a dedicated customization page for each theme instead of expanding every theme on one screen.
- Preview each theme in a new tab with `/?previewTheme=theme-id`.

Admin users can open `/admin/theme/theme-1`, `/admin/theme/theme-2`, `/admin/theme/theme-3`, `/admin/theme/theme-4`, `/admin/theme/theme-5`, `/admin/theme/theme-6`, `/admin/theme/theme-7`, or any registered theme URL to:

- Customize all static homepage copy for every registered theme, including hero text, CTAs, section headings, stat labels, feature labels, course/card microcopy, instructor/review fallback text, journey labels, and final conversion text.
- Customize each theme's visual layer independently: accent colors, soft accent tint, homepage background, surface colors, text color, muted text, border color, primary button text color, body/display font stacks, control/card radii, elevation shadow, hero image URL/upload, hero image alt text, and hero overlay.
- Reset one theme or all themes to localized defaults.

Admin users can open `/admin/theme/global` to:

- Customize shared visual tokens such as primary color, hover color, soft brand color, background, text, muted text, border, panel colors, button text, radius, and font family.

Dynamic homepage content is controlled from its own admin area:

- Course titles, descriptions, prices, and covers: course management.
- Category names: categories.
- Instructor names and bios: users/instructors.
- Reviews and ratings: reviews.
- Header and footer links: general settings/navigation settings.
