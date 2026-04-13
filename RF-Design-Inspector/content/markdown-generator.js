// RF Design Inspector — Markdown Generator (Multi-section)
const MarkdownGenerator = (() => {

  // Generate markdown with only the selected sections
  // sections: array of strings e.g. ['element', 'styles', 'html', 'classname']
  function generate(data, sections) {
    if (!sections || sections.length === 0) sections = [];

    const parts = [];

    if (sections.includes('element')) {
      const selector = buildSelector(data);
      const parent = buildParentChain(data);
      parts.push(`Element: ${selector} (${data.rect.width}×${data.rect.height})`);
      parts.push(`File: ${data.pageUrl}`);
      parts.push(`Path: ${parent}`);
    }

    if (sections.includes('classname')) {
      if (data.classes.length > 0) {
        parts.push(`Class: .${data.classes.join('.')}`);
      } else {
        parts.push(`Class: (none)`);
      }
    }

    if (sections.includes('styles')) {
      parts.push(buildKeyStyles(data));
    }

    if (sections.includes('html')) {
      parts.push('```html');
      parts.push(data.html);
      parts.push('```');
    }

    return parts.join('\n');
  }

  function buildSelector(data) {
    let s = data.tag;
    if (data.id) s += `#${data.id}`;
    if (data.classes.length) s += `.${data.classes.join('.')}`;
    return s;
  }

  function buildParentChain(data) {
    const chain = [...data.parentChain].reverse().map(p => {
      let s = p.tag;
      if (p.id) s += `#${p.id}`;
      else if (p.classes.length) s += `.${p.classes[0]}`;
      return s;
    });
    chain.push(buildSelector(data));
    return chain.join(' > ');
  }

  function buildKeyStyles(data) {
    const s = data.styles;
    const vars = data.cssVariables || {};
    const pairs = [];

    if (s.display !== 'block') pairs.push(['display', s.display]);
    if (s.position !== 'static') pairs.push(['position', s.position]);

    if (s.padding !== '0px') pairs.push(['padding', s.padding]);
    if (s.margin !== '0px') pairs.push(['margin', s.margin]);
    if (s.gap && s.gap !== 'normal') pairs.push(['gap', s.gap]);

    const font = s.fontFamily.replace(/"/g, '').split(',')[0].trim();
    pairs.push(['font', `${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${font}`]);
    pairs.push(['color', rgbToHex(s.color) || s.color]);

    const bg = rgbToHex(s.backgroundColor);
    if (bg && s.backgroundColor !== 'rgba(0, 0, 0, 0)') pairs.push(['bg', bg]);
    if (s.borderRadius && s.borderRadius !== '0px') pairs.push(['radius', s.borderRadius]);
    if (s.border && !s.border.startsWith('0px')) pairs.push(['border', formatBorderHex(s.border)]);
    if (s.boxShadow && s.boxShadow !== 'none') pairs.push(['shadow', s.boxShadow]);

    const styleStr = pairs.map(([k, v]) => {
      const token = vars[k] || '';
      return token ? `${k}: ${v} (${token})` : `${k}: ${v}`;
    }).join(' | ');

    return `Styles: ${styleStr}`;
  }

  function rgbToHex(rgb) {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function formatBorderHex(border) {
    return border.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, (m, r, g, b) => {
      return '#' + [r, g, b].map(v => parseInt(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    });
  }

  return { generate };
})();
