# Navigation Troubleshooting Guide

## Problem
After loading a page, clicking sidebar links to navigate to other pages doesn't work.

## How to Enable Diagnostics

1. **Open your browser's Developer Console** (F12 or Right-click → Inspect → Console tab)

2. **Enable diagnostics** by running this in the console:
   ```javascript
   localStorage.setItem("DEBUG_NAVIGATION", "1")
   ```

3. **Refresh the page** (F5)

4. **Try to navigate** - click on a sidebar link that's not working

5. **Check the console** - you'll see detailed diagnostic information including:
   - Overlays that might be blocking clicks
   - Body/HTML styles that might be locked
   - Open dialogs/modals
   - Sidebar links and their states
   - Elements with `pointer-events: none`
   - Z-index stacking issues
   - Drag state information

## What to Look For

### Common Issues:

1. **Overlay blocking clicks**
   - Look for overlays with high z-index (≥40) that cover the sidebar
   - Check if mobile sidebar overlay didn't close

2. **Body/HTML locked**
   - Check if `pointer-events: none` is set on body/html
   - Check if `user-select: none` is stuck
   - Check if `cursor: resize` is stuck (from resize operations)

3. **Drag state stuck**
   - Check if `isDragging` is true when it shouldn't be
   - Look for elements with "dragging" classes

4. **Z-index issues**
   - Check if something with high z-index is covering the sidebar
   - Sidebar should be z-50, overlays should be z-40

## Quick Fixes to Try

### 1. Force unlock interactions
Press **Escape** key - this should unlock any stuck interactions

### 2. Check for stuck drag state
In console, run:
```javascript
// Check if dragging state is stuck
console.log("Drag state:", {
  isDragging: document.querySelector('[class*="dragging"]'),
  activeId: document.querySelector('[class*="drag"]'),
})
```

### 3. Force clear body styles
In console, run:
```javascript
document.body.style.pointerEvents = ""
document.body.style.userSelect = ""
document.body.style.cursor = ""
document.documentElement.style.pointerEvents = ""
```

### 4. Check for blocking overlays
In console, run:
```javascript
// Find all overlays
const overlays = document.querySelectorAll('[class*="fixed"][class*="inset"]')
overlays.forEach(el => {
  const style = window.getComputedStyle(el)
  console.log("Overlay:", {
    element: el,
    zIndex: style.zIndex,
    pointerEvents: style.pointerEvents,
    display: style.display,
  })
})
```

## Disable Diagnostics

When done troubleshooting, disable diagnostics:
```javascript
localStorage.removeItem("DEBUG_NAVIGATION")
```

## Reporting Issues

When reporting navigation issues, please include:
1. Console output from diagnostics (copy/paste)
2. Which page you're on when it happens
3. Which page you're trying to navigate to
4. Browser and version
5. Whether it happens on mobile or desktop
