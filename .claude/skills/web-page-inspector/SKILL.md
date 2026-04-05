---
name: web-page-inspector
description: >
  Autonomous web page debugging and review using dual Playwright MCPs (playwright + playwright-vision).
  Performs comprehensive page inspection combining accessibility-based structural analysis with visual
  screenshot verification. Use when: debugging web UI issues, reviewing web page quality, "check this page",
  "debug the UI", "inspect the website", "review the frontend", "test this page", visual regression check,
  accessibility audit, responsive design testing, console error investigation, network failure diagnosis,
  broken layout detection, form validation testing, or any web page quality assessment.
  Works alongside /systematic-debugging, /dual-agent-debug, /code-review-excellence, and /dual-agent-review
  for end-to-end web development quality assurance. Delegates code-level fixes to those skills.
---

# Web Page Inspector

Dual-MCP web page inspection: structural analysis (playwright) + visual verification (playwright-vision).

## Dual MCP Architecture

Both MCPs are the same @playwright/mcp server with different capability configs:
- **playwright** (`mcp__playwright__`): Snapshot mode — accessibility tree with `[ref=XX]` identifiers
- **playwright-vision** (`mcp__playwright-vision__`): Vision mode — `--caps=vision` enabled, adds coordinate-based mouse tools

### Tool Selection Matrix

| Task | MCP | Tool | Why |
|------|-----|------|-----|
| Page structure | playwright | `browser_snapshot` | Returns accessibility tree with refs, roles, names |
| Visual layout | vision | `browser_take_screenshot` | Pixel-level rendering verification |
| Click element | playwright | `browser_click(ref, element)` | Ref-based = deterministic, no ambiguity |
| Click without ref | vision | `browser_mouse_click_xy(x, y)` | Fallback for elements invisible to a11y tree |
| Console errors | playwright | `browser_console_messages(level)` | Same on both, use primary |
| Network requests | playwright | `browser_network_requests(includeStatic)` | Same on both, use primary |
| Form filling | playwright | `browser_fill_form(fields)` | Ref-based field targeting |
| Page JS execution | playwright | `browser_evaluate(function)` | Runs JS in page context |
| Complex Playwright API | playwright | `browser_run_code(code)` | Full `page` object access |
| Scroll | vision | `browser_mouse_wheel(deltaX, deltaY)` | Only available in vision mode |
| Responsive resize | vision | `browser_resize(width, height)` | Then screenshot for visual check |
| Wait for state | playwright | `browser_wait_for(text/textGone/time)` | Wait for DOM changes |
| Keyboard test | playwright | `browser_press_key(key)` | Tab, Enter, Escape, Arrow keys |
| Hover test | playwright | `browser_hover(ref)` | Tooltip/popover triggers |

### browser_evaluate vs browser_run_code (CRITICAL)

**`browser_evaluate`** — JS in page context (like DevTools Console):
```
function: "() => document.title"
function: "(element) => element.textContent"  // with ref + element params
```
- Returns serializable values only
- Can target specific element via `ref` param — element passed as function argument
- Use for: DOM queries, reading values, simple checks

**`browser_run_code`** — Full Playwright API (like a test script):
```
code: "async (page) => { await page.getByRole('button', {name: 'Submit'}).click(); return await page.title(); }"
```
- Access to `page` object: locators, waitFor, evaluate, route, etc.
- State persists across invocations
- Use for: multi-step operations, custom waits, complex assertions, batch operations

### Snapshot Format

`browser_snapshot` returns a markdown-style accessibility tree:
```
- heading "Welcome" [level=1]
- navigation "Main"
  - link "Home" [ref=s1e3]
  - link "About" [ref=s1e4]
- main
  - textbox "Email" [ref=s1e7]
  - button "Submit" [ref=s1e8]
```
- `[ref=XX]` = use in `browser_click`, `browser_type`, `browser_hover`, `browser_evaluate`
- Incremental snapshots (default) = only changes since last snapshot (saves tokens)
- After actions, tools auto-return updated snapshot

### browser_fill_form Field Types

```json
{
  "fields": [
    {"name": "Email", "type": "textbox", "ref": "s1e7", "value": "test@example.com"},
    {"name": "Agree", "type": "checkbox", "ref": "s1e9", "value": "true"},
    {"name": "Gender", "type": "radio", "ref": "s1e10", "value": "female"},
    {"name": "Country", "type": "combobox", "ref": "s1e11", "value": "Japan"},
    {"name": "Volume", "type": "slider", "ref": "s1e12", "value": "75"}
  ]
}
```

### browser_wait_for Patterns

```
Wait for text to appear:   { text: "Loading complete" }
Wait for text to vanish:   { textGone: "Loading..." }
Wait for fixed time:       { time: 2 }  // seconds
```
Use `text`/`textGone` over `time` whenever possible — deterministic and faster.

## Workflow

**Mode selection:**
- User reports specific issue → **Debug Mode**
- General quality check → **Review Mode**
- Unclear → Review Mode (catches debug issues too)

### Debug Mode

1. **Navigate & Capture** (parallel calls where possible)
   - `playwright__browser_navigate(url)`
   - Then parallel: `browser_console_messages(level:"error")` + `browser_network_requests(includeStatic:false)` + `browser_snapshot`

2. **Triage Errors**
   - Console errors → categorize: JS runtime | resource 404 | framework | API response
   - Network 4xx/5xx → identify broken endpoints and payloads
   - Snapshot → check missing refs, broken structure, empty containers

3. **Visual Cross-Check**
   - `playwright-vision__browser_take_screenshot(type:"png")` — current rendered state
   - Compare against expected behavior; flag layout breaks, invisible elements, z-index issues

4. **Interactive Reproduction**
   - Replay user-reported steps using `playwright__browser_click(ref)` / `browser_type(ref, text)`
   - After each action: check `browser_console_messages` for new errors
   - For elements not in snapshot: `playwright-vision__browser_mouse_click_xy(x, y)`
   - Use `browser_wait_for(text)` between steps — never arbitrary time waits

5. **Deep Investigation** (when needed)
   - `browser_run_code` for complex reproduction:
     ```
     async (page) => {
       await page.getByRole('button', {name: 'Add'}).click();
       await page.waitForSelector('.item-list .item', {state: 'attached'});
       return await page.locator('.item-list .item').count();
     }
     ```
   - `browser_evaluate` with element ref for inspecting specific nodes

6. **Root Cause Summary** → hand off to code-level skills

### Review Mode

Full criteria in [references/review-checklist.md](references/review-checklist.md).

1. **Structural Audit** (playwright)
   - `browser_snapshot` → heading hierarchy, landmark roles, form labels, ARIA
   - `browser_evaluate` → DOM queries (see recipes below)
   - `browser_console_messages(level:"warning")` → deprecations, warnings

2. **Visual Audit** (playwright-vision)
   - `browser_take_screenshot(fullPage:true)` → full page capture
   - Responsive test: resize to each breakpoint, screenshot, snapshot
   - Check alignment, overflow, truncation, font rendering

3. **Interaction Audit** (both)
   - `browser_fill_form` with valid/invalid data → verify validation messages
   - `browser_click` major navigation links → verify routing (check snapshot URL)
   - `browser_press_key("Tab")` repeatedly → verify focus order
   - `browser_hover(ref)` → verify tooltips/popovers appear in next snapshot
   - `browser_handle_dialog(accept)` → if dialogs appear during testing

4. **Performance** (playwright)
   - `browser_network_requests(includeStatic:true)` → total count, failed, large payloads
   - `browser_evaluate` → performance timing, DOM size, resource summary

5. **Generate Report**

## Responsive Testing

```
For each width in [375, 768, 1024, 1280]:
  1. playwright-vision__browser_resize(width=W, height=900)
  2. playwright-vision__browser_take_screenshot(type:"png", fullPage:true)
  3. playwright__browser_snapshot  // structure may change (hamburger menu, stacking)
  4. Record: menu state, column layout, text readability, overflow, touch target sizes
```

## Report Format

```markdown
# Web Page Inspection Report

**URL**: [target] | **Mode**: Debug/Review | **Issues**: X critical, Y warning, Z info

## Critical Issues
- [CRITICAL] Description — element [ref] / screenshot evidence — fix recommendation

## Warnings
- [WARNING] Description — element/location — recommendation

## Info
- [INFO] Description — suggestion

## Responsive
| Breakpoint | Status | Notes |
|------------|--------|-------|

## Hand-off
> Code-level: /systematic-debugging or /dual-agent-debug
> Quality: /code-review-excellence or /dual-agent-review
> Security: /security-review
```

## Code-Level Skill Hand-off

This skill inspects the **running page only**. For source code fixes, delegate:

| Finding | Delegate To |
|---------|-------------|
| JS runtime error traced to source | /systematic-debugging or /dual-agent-debug |
| Code quality / pattern issue | /code-review-excellence or /dual-agent-review |
| Security concern (XSS, open redirect, exposed tokens) | /security-review |
| Build/compile error preventing page load | /build-resolver |

Do NOT fix source code within this skill. Report and delegate.

## Common Pitfalls

- **Do not use `time` waits** when `text`/`textGone` waits work — deterministic > arbitrary
- **Always get snapshot before clicking** — refs are only valid from the latest snapshot
- **Incremental snapshots may omit unchanged elements** — use full `browser_snapshot` after navigation or major state change if context is lost
- **`browser_evaluate` ref param**: pass `ref` AND `element` description, function receives element as argument: `(element) => element.value`
- **Vision coordinate clicks bypass a11y validation** — use only when ref-based click is impossible
- **Screenshots are evidence, not source of truth** — always cross-check with snapshot for structural issues
- **browser_run_code persists state** — can build on previous invocations within same session

## browser_evaluate Recipes

```javascript
// DOM element count
() => document.querySelectorAll('*').length

// Images without alt text
() => [...document.querySelectorAll('img:not([alt])')].map(i => ({src:i.src, w:i.width, h:i.height}))

// Performance timing (modern API)
() => {
  const nav = performance.getEntriesByType('navigation')[0]
  return nav ? { domReady: Math.round(nav.domContentLoadedEventEnd),
    fullLoad: Math.round(nav.loadEventEnd),
    ttfb: Math.round(nav.responseStart) } : 'Navigation Timing unavailable'
}

// Broken same-origin links (max 20)
async () => {
  const urls = [...new Set([...document.querySelectorAll('a[href]')]
    .map(a => a.href).filter(h => h.startsWith(location.origin)))]
  const res = await Promise.allSettled(urls.slice(0,20).map(u => fetch(u, {method:'HEAD'})))
  return urls.slice(0,20).map((url,i) => ({url,
    status: res[i].status==='fulfilled' ? res[i].value.status : 'error'
  })).filter(r => r.status !== 200)
}

// Form fields without labels
() => [...document.querySelectorAll('input,select,textarea')]
  .filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
  .map(el => ({tag:el.tagName, type:el.type, name:el.name, id:el.id}))

// Heading hierarchy check
() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
  .map(h => ({level:parseInt(h.tagName[1]), text:h.textContent?.trim().slice(0,50)}))

// Viewport overflow detection
() => document.documentElement.scrollWidth > document.documentElement.clientWidth

// Resource summary
() => {
  const entries = performance.getEntriesByType('resource')
  const byType = {}
  entries.forEach(e => {
    const t = e.initiatorType || 'other'
    byType[t] = byType[t] || {count:0, totalKB:0}
    byType[t].count++
    byType[t].totalKB += Math.round(e.transferSize/1024)
  })
  return {total: entries.length, byType}
}

// CSP header check
() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || 'No CSP meta tag'
```

## browser_run_code Power Recipes

```javascript
// Comprehensive link check with navigation
async (page) => {
  const links = await page.locator('a[href]').evaluateAll(
    els => els.map(e => ({href: e.href, text: e.textContent?.trim().slice(0,30)}))
      .filter(l => l.href.startsWith(location.origin))
  )
  return { totalInternalLinks: links.length, sample: links.slice(0, 10) }
}

// Tab order audit
async (page) => {
  const order = []
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      return el ? {tag: el.tagName, role: el.role, name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0,30), id: el.id} : null
    })
    if (!focused || focused.tag === 'BODY') break
    order.push(focused)
  }
  return order
}

// Form validation test
async (page) => {
  const submit = page.getByRole('button', {name: /submit|send|save/i})
  if (await submit.count() === 0) return 'No submit button found'
  await submit.click()
  await page.waitForTimeout(500)
  const errors = await page.locator('[class*="error"], [role="alert"], .invalid-feedback, .field-error')
    .evaluateAll(els => els.map(e => e.textContent?.trim()).filter(Boolean))
  return { validationErrors: errors }
}
```
