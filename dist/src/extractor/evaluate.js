export const extractDomTreeScript = `
function extractDomTree(config) {
  const { styleFields, ignoredSelectors } = config;

  function getRole(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || '';
    
    if (tag === 'button' || (tag === 'input' && (type === 'button' || type === 'submit' || type === 'reset'))) return 'button';
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return 'heading';
    if (tag === 'input' && type === 'checkbox') return 'checkbox';
    if (tag === 'input' && type === 'radio') return 'radio';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'textbox';
    if (tag === 'img') return 'img';
    if (tag === 'ul' || tag === 'ol') return 'list';
    if (tag === 'li') return 'listitem';
    if (tag === 'nav') return 'navigation';
    if (tag === 'main') return 'main';
    if (tag === 'section') return 'region';
    if (tag === 'dialog') return 'dialog';
    
    return 'generic';
  }

  function getLabel(el) {
    return el.getAttribute('aria-label') || 
           el.getAttribute('title') || 
           el.getAttribute('alt') || 
           (el.innerText || '').trim() || 
           '';
  }

  function generateId(el, role, label) {
    const truncLabel = label.substring(0, 15).replace(/[^a-zA-Z0-9-]/g, '');
    let ancestor = el.parentElement;
    let ancestorName = 'root';
    
    while (ancestor && ancestor !== document.body) {
      if (ancestor.id) {
        ancestorName = 'id-' + ancestor.id;
        break;
      }
      if (ancestor.getAttribute('data-testid')) {
        ancestorName = 'test-' + ancestor.getAttribute('data-testid');
        break;
      }
      if (ancestor.getAttribute('aria-label')) {
        const al = ancestor.getAttribute('aria-label');
        ancestorName = 'aria-' + al.substring(0, 10).replace(/[^a-zA-Z0-9-]/g, '');
        break;
      }
      ancestor = ancestor.parentElement;
    }

    let index = 0;
    const parentToScan = ancestor || document.body;
    const tag = el.tagName.toLowerCase();
    const sameTags = parentToScan.querySelectorAll(tag);
    for (let i = 0; i < sameTags.length; i++) {
        if (sameTags[i] === el) {
            index = i;
            break;
        }
    }

    return (role + '-' + truncLabel + '-' + ancestorName + '-' + index).toLowerCase();
  }

  function getShortSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
    const tag = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\\s+/)[0];
      if (cls) return tag + '.' + cls;
    }
    return tag;
  }

  function walk(el, ignoredSelectorsJoined) {
    if (ignoredSelectorsJoined && el.matches && el.matches(ignoredSelectorsJoined)) {
        return null;
    }

    const rect = el.getBoundingClientRect();
    const compStyles = window.getComputedStyle(el);
    
    const isVisible = rect.width > 0 && rect.height > 0 && 
                      compStyles.visibility !== 'hidden' && 
                      compStyles.display !== 'none' && 
                      compStyles.opacity !== '0';

    const role = getRole(el);
    const label = getLabel(el);
    const id = generateId(el, role, label);

    const extractedStyles = {};
    for (const field of styleFields) {
      extractedStyles[field] = compStyles[field];
    }

    let events = undefined;
    if (window._pagespec_events && window._pagespec_events.has(el)) {
       events = Array.from(window._pagespec_events.get(el));
    }

    let isObscured = undefined;
    let obscuredBy = undefined;
    const isInteractive = role === 'button' || role === 'link' || role === 'textbox' || role === 'checkbox' || role === 'radio' || el.tagName.toLowerCase() === 'input';
    
    if (isVisible && isInteractive) {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      // Only check element from point if it's within viewport bounds
      if (centerX >= 0 && centerY >= 0 && centerX <= window.innerWidth && centerY <= window.innerHeight) {
        const topEl = document.elementFromPoint(centerX, centerY);
        if (topEl && topEl !== el && !el.contains(topEl)) {
           isObscured = true;
           obscuredBy = getShortSelector(topEl);
        } else {
           isObscured = false;
        }
      }
    }

    const node = {
      id,
      role,
      label,
      tag: el.tagName.toLowerCase(),
      selector: getShortSelector(el),
      bounds: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      visible: isVisible,
      isObscured,
      obscuredBy,
      events,
      state: {
        focused: document.activeElement === el,
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        expanded: el.getAttribute('aria-expanded') === 'true' ? true : undefined,
        checked: el.checked || el.getAttribute('aria-checked') === 'true' ? true : undefined,
        value: el.value || undefined
      },
      styles: extractedStyles,
      children: []
    };

    for (const child of Array.from(el.children)) {
      if (child.tagName.toLowerCase() === 'script' || child.tagName.toLowerCase() === 'style') continue;
      
      const childNode = walk(child, ignoredSelectorsJoined);
      if (childNode) {
        node.children.push(childNode);
      }
    }

    return node;
  }

  const ignoredSelectorsJoined = ignoredSelectors.join(',');
  
  let rootElement = document.body;
  if (config.focusSelector) {
    const focused = document.querySelector(config.focusSelector);
    if (focused) {
      rootElement = focused;
    }
  }
  
  return walk(rootElement, ignoredSelectorsJoined);
}
return extractDomTree(config);
`;
