---
name: ink
description: Create static, consumable Ink documents and publish them through fabs.ink. Use when the user mentions Ink or fabs.ink, wants content formatted for the fabs.ink CLI, or needs a report, brief, summary, guide, or proposal shared as a safe hosted document.
---

# Ink

Turn the user's source material into a focused document designed for fabs.ink.

## What makes an Ink

An Ink is a static document fragment, not a full website or unrestricted HTML page. fabs.ink sanitizes the submitted content and places the surviving fragment inside its own trusted document wrapper.

Author the meaningful body content only. A final Ink file may use a `<body class="...">` wrapper so fabs.ink can preserve page-level Tailwind classes, but do not add `doctype`, `html`, `head`, `title`, `meta`, `link`, `script`, or `style` elements. Put the visible document title in an `h1`.

Use only these supported content elements:

```text
header main section article nav aside footer div p ul ol li
h1 h2 h3 h4 h5 h6 span strong em code pre blockquote
table thead tbody tr td th a img
```

Use attributes within the Ink contract:

- Use `class` for Tailwind styling on supported elements and the optional `body` wrapper.
- Use `href` only on `a`, and only with a complete `https://` URL.
- Use `src` and `alt` only on `img`. Use an image only when a known same-origin asset path already exists; remote images and data URLs do not survive publishing.
- Do not rely on IDs, inline styles, event handlers, data attributes, form attributes, or other HTML attributes.

fabs.ink supplies the baseline styles and Tailwind runtime. Use Tailwind utility classes directly; do not load fonts, stylesheets, scripts, or other external resources. An Ink has no client-side JavaScript, forms, embedded media, SVG, canvas, or interactive application behavior.

## Workflow

1. Read the source material and preserve its meaning. Ask a question only when missing information would materially change the document.
2. Create the Ink in `docs/` unless the user specifies another location. Use a short, descriptive kebab-case `.html` filename.
3. Begin with an optional `body` wrapper for page-level classes, then structure the content with semantic supported elements.
4. Use a clear heading hierarchy, readable line lengths, responsive Tailwind utilities, restrained color, and generous whitespace.
5. Make the Ink understandable without chat narration. Include its visible title, context, dates, labels, and complete HTTPS source links where relevant.
6. Keep accessibility within the supported format: sufficient contrast, visible focus utilities, meaningful link text, table headers, and alt text for every informative image.
7. Avoid navigation that depends on fragment links because IDs and relative links are not part of the Ink format. For long documents, use a plain contents list or clear section numbering.
8. Keep the file comfortably below 10 MiB and ensure useful content remains even when optional imagery is unavailable.
9. If the user asks to publish or share the result, run `fabs.ink publish <path>`. Inspect the published Ink at desktop and narrow widths when browser tooling is available, fix layout issues, and return the URL. Otherwise, return the local Ink source path.

## Constraints

- Keep the Ink static, focused, and document-like rather than turning it into a website or application.
- Do not introduce a framework, build step, package dependency, or custom CSS.
- Do not invent facts or silently omit important source content.
- Do not add decorative charts, icons, or imagery unless they materially improve comprehension and fit the Ink format.
- Avoid generic dashboard styling, excessive cards, gradients, ornamental badges, and application chrome.
