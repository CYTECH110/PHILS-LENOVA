const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const CSS_FILE = 'client/css/styles.css';
const out = [];
const check = (label, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);

const source = fs.readFileSync(path.join(ROOT, CSS_FILE), 'utf8');
const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');

function main() {
  /* --- 1. structural balance --- */
  const count = (ch) => (withoutComments.match(new RegExp(`\\${ch}`, 'g')) || []).length;
  check('braces balanced', count('{') === count('}'), `{=${count('{')} }=${count('}')}`);
  check('parens balanced', count('(') === count(')'), `(${count('(')} )=${count(')')}`);

  const depth = [];
  for (const ch of withoutComments) {
    if (ch === '{') depth.push(ch);
    if (ch === '}') {
      if (!depth.length) return check('no closing brace without an opener', false, 'extra }');
      depth.pop();
    }
  }
  check('no closing brace without an opener', depth.length === 0);

  /* --- 2. every declaration parses: `property: value;` --- */
  const declarations = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  let rules = 0;
  let bad = [];
  while ((m = ruleRe.exec(withoutComments))) {
    rules++;
    const selector = m[1].trim();
    if (!selector) bad.push('rule with empty selector');
    if (/@/.test(selector) === false && !/^(@|[.#a-zA-Z\[:*])/.test(selector)) bad.push(`odd selector: ${selector.slice(0, 40)}`);

    const body = m[2].trim();
    if (!body) continue;
    for (const decl of body.split(';')) {
      const text = decl.trim();
      if (!text) continue;
      const idx = text.indexOf(':');
      if (idx < 0) {
        bad.push(`declaration without ':' -> ${text}`);
        continue;
      }
      const prop = text.slice(0, idx).trim();
      const value = text.slice(idx + 1).trim();
      declarations.push(prop);
      // valid CSS ident / custom property
      if (!/^(--[a-z0-9-]+|[a-z][a-z0-9-]*)$/.test(prop)) bad.push(`invalid property "${prop}"`);
      if (!value) bad.push(`empty value for "${prop}"`);
      if (/[\\"']/.test(value)) bad.push(`suspicious quote/backslash in "${prop}: ${value}"`);
    }
  }
  check('every declaration is `property: value;`', bad.length === 0, bad.slice(0, 5).join(' | '));
  check('rules found (parse produced a stylesheet)', rules >= 20, `rules=${rules}, declarations=${declarations.length}`);

  /* --- 3. scan for corruption artefacts --- */
  const garbage = withoutComments.match(/[A-Z]{3,}/g) || [];
  check('no 3+ uppercase runs (the OPEOK-style corruption)', garbage.length === 0, garbage.join(', '));

  const stray = withoutComments.split(/\r?\n/).filter((l) => /^[+~]|^<{7}|^>{7}|^-{7}/.test(l));
  check('no diff markers', stray.length === 0, stray.join(' | '));

  const unknownProps = declarations.filter((p) => p !== '--ink' && !/^(--|[a-z-]+$)/.test(p));
  check('no malformed property names remain', unknownProps.length === 0, unknownProps.join(', '));

  /* --- 4. the reported bug specifically --- */
  const h1 = /(^|\n)h1 \{([^}]*)\}/.exec(withoutComments);
  check('h1 rule exists', !!h1);
  check('h1 uses max-width (not max-OPEOKwidth)', !!h1 && /max-width:\s*660px/.test(h1[2]) && !/OPEOK/.test(h1[2]), h1 && h1[2].trim());
  check('file no longer contains "OPEOK"', !/OPEOK/.test(source));

  /* --- 5. declared properties are all real CSS properties --- */
  const known = new Set([
    'color-scheme', 'box-sizing', 'margin', 'margin-top', 'min-height', 'background', 'color', 'font', 'max-width', 'padding',
    'letter-spacing', 'display', 'flex-wrap', 'gap', 'border', 'border-bottom', 'text-decoration', 'border-color',
    'grid-template-columns', 'cursor', 'font-weight', 'filter', 'border-collapse', 'text-align', 'text-transform',
    'align-items', 'justify-content', 'flex-direction', 'line-height', 'font-size', 'padding-bottom', 'padding-top', 'width'
  ]);
  const unknown = [...new Set(declarations.filter((p) => !p.startsWith('--') && !known.has(p)))];
  check('all properties are real CSS properties', unknown.length === 0, unknown.join(', '));

  console.log(out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL'));
  console.log(`\n${out.length - failed.length}/${out.length} passed`);
  console.log(failed.length ? 'RESULT: FAILURES' : 'RESULT: ALL PASS');
}

main();
