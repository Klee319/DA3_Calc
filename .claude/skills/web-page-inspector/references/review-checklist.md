# Web Page Review Checklist

Comprehensive criteria for Review Mode. Each section specifies exact tools and methods.

## 1. Accessibility (a11y)

### Semantic Structure — `playwright__browser_snapshot`
The snapshot directly reveals structure. Verify:
- [ ] Single `h1`, then `h2` → `h3` without skips (use heading recipe from SKILL.md)
- [ ] Landmark roles: `main`, `navigation`, `banner`, `contentinfo`, `complementary`
- [ ] Lists use proper roles (list/listitem), not generic divs
- [ ] Tables show `rowgroup`, `row`, `columnheader` in snapshot

### Images & Media — `playwright__browser_evaluate`
- [ ] `img:not([alt])` returns empty array
- [ ] Decorative images have `alt=""`
- [ ] SVG icons have `aria-hidden="true"` or meaningful `aria-label`

### Forms — `playwright__browser_snapshot` + `browser_fill_form`
- [ ] Every input/textbox in snapshot has a visible label/name
- [ ] Fill with invalid data → check for `[role="alert"]` or error text in next snapshot
- [ ] Required fields: submit empty form → errors appear
- [ ] Error messages descriptive (not just "invalid")

### Keyboard — `playwright__browser_press_key` + `browser_run_code`
- [ ] Tab through all interactive elements (use tab order audit recipe)
- [ ] Focus indicator visible (screenshot after each Tab)
- [ ] No keyboard traps (Tab cycles through, doesn't get stuck)
- [ ] Enter/Space activates buttons, Enter submits forms
- [ ] Escape closes modals/popups

### ARIA — `playwright__browser_snapshot` + `browser_evaluate`
- [ ] `aria-expanded` toggles on accordion/dropdown click
- [ ] `aria-selected` updates on tab/option selection
- [ ] No redundant ARIA (snapshot shows native roles already)

## 2. Visual & Layout

### Alignment — `playwright-vision__browser_take_screenshot(fullPage:true)`
- [ ] Consistent spacing between sections
- [ ] No horizontal overflow: `browser_evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)`
- [ ] Content contained within viewport width
- [ ] Grid/flex alignment consistent

### Typography — Screenshot inspection
- [ ] Body text ≥ 14px
- [ ] Line height comfortable (not cramped or overly spaced)
- [ ] No text clipped by overflow:hidden
- [ ] Fonts loaded (no placeholder/system font flashes persisting)

### Color & Contrast — `browser_evaluate` + screenshot
- [ ] Run color contrast recipe from SKILL.md
- [ ] Interactive elements visually distinct from static text
- [ ] Error states use more than just color (icon, text, border)

### Images — Screenshot + `browser_evaluate`
- [ ] No broken image placeholders visible
- [ ] Images properly sized (not stretched/squished)
- [ ] Lazy images load on `browser_mouse_wheel(deltaY: 500)` scroll

## 3. Responsive Design

### Test Procedure
For each breakpoint, run the SKILL.md responsive testing sequence.

### Mobile (375px)
- [ ] Nav → hamburger/drawer (check snapshot for `button` with menu-like name)
- [ ] Single column layout
- [ ] Touch targets ≥ 44x44px (evaluate with recipe below)
- [ ] No horizontal scroll
- [ ] Text readable without zoom

### Tablet (768px)
- [ ] Layout adapts (2-column or sidebar collapses)
- [ ] Images scale, don't overflow
- [ ] Navigation accessible

### Desktop (1280px)
- [ ] Full navigation rendered
- [ ] Content has max-width (lines not too long)
- [ ] Balanced whitespace

### Touch Target Recipe
```javascript
() => [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]')]
  .map(el => {const r = el.getBoundingClientRect(); return {
    tag: el.tagName, text: (el.textContent||'').trim().slice(0,20),
    w: Math.round(r.width), h: Math.round(r.height)
  }}).filter(el => el.w < 44 || el.h < 44)
```

## 4. Functionality

### Navigation — `playwright__browser_click(ref)` + snapshot URL check
- [ ] Click each nav link → snapshot shows correct page/heading
- [ ] `browser_navigate_back` works after each click
- [ ] Active state indicated in snapshot (e.g., `[current="page"]`, different role/name)
- [ ] Broken link recipe from SKILL.md returns empty

### Forms — `playwright__browser_fill_form` + `browser_click`
Test sequence:
1. `browser_snapshot` → identify form fields and submit button
2. `browser_fill_form` with valid data → click submit → check success state
3. `browser_fill_form` with empty required fields → click submit → check error messages
4. `browser_fill_form` with invalid format → click submit → check specific errors
5. After each: `browser_wait_for(text: "error message")` or `browser_wait_for(text: "success")`

### Interactive Elements — `playwright__browser_click` + `browser_hover`
- [ ] Buttons: click → check snapshot for state change
- [ ] Dropdowns: `browser_select_option(ref, values)` → verify selection
- [ ] Modals: click trigger → `browser_wait_for(text: "modal title")` → verify focus trapped (Tab stays inside) → close with Escape
- [ ] Tooltips: `browser_hover(ref)` → screenshot to verify visual appearance
- [ ] Loading: trigger async action → `browser_wait_for(text: "Loading")` then `browser_wait_for(textGone: "Loading")`

## 5. Performance

### Load — `playwright__browser_evaluate`
Use the Performance Timing recipe from SKILL.md:
- [ ] TTFB < 600ms
- [ ] DOM Content Loaded < 2s
- [ ] Full load < 5s

### Resources — `browser_evaluate` resource summary recipe
- [ ] Total DOM elements < 3000
- [ ] Total network requests < 100 on initial load
- [ ] No single resource > 1MB (check `byType` breakdown)
- [ ] No duplicate requests (same URL fetched multiple times)

### Console — `playwright__browser_console_messages`
- [ ] `level: "error"` → zero errors
- [ ] `level: "warning"` → no framework deprecations, no mixed content

### Network Failures — `playwright__browser_network_requests`
- [ ] No failed requests (4xx/5xx status codes)
- [ ] No CORS errors
- [ ] All API calls return expected structure

## 6. Security Surface

Observable from running page only. Full audit requires /security-review.

- [ ] URL bar shows HTTPS
- [ ] `browser_evaluate(() => location.protocol)` returns `"https:"`
- [ ] No sensitive data in URL: `browser_evaluate(() => location.search)` should not contain tokens/passwords
- [ ] CSP meta tag present (use CSP recipe from SKILL.md)
- [ ] `browser_evaluate(() => document.cookie)` — check for missing `Secure`/`HttpOnly` flags
- [ ] No inline event handlers with user data: `browser_evaluate(() => [...document.querySelectorAll('[onclick],[onerror]')].length)`

## Severity Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| **CRITICAL** | Blocks functionality, security issue, page crash, data loss risk | Must fix immediately |
| **WARNING** | Degrades UX, a11y violation (WCAG AA fail), performance issue | Fix before release |
| **INFO** | Best practice, minor polish, optimization opportunity | Nice to have |
