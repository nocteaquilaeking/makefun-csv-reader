// Slice ordinary fields; only malformed or escaped content needs assembly.
export function run(input) {
  const text = String(input.text), n = text.length;
  const header = input.header === true;
  const rows = [], errors = [];
  let columns = null, width = -1, p = text.charCodeAt(0) === 65279 ? 1 : 0;
  let line = 1;
  // Delimiter searches are cached across fields, including quoted fields.
  let comma = -1, lf = -1, cr = -1;
  while (p < n) {
    let c = text.charCodeAt(p);
    if (c === 10) { p++; line++; continue; }
    if (c === 13 && text.charCodeAt(p + 1) === 10) { p += 2; line++; continue; }
    const isHeader = header && columns === null;
    const recordLine = line, recordRow = isHeader ? null : rows.length;
    const fields = [];
    let more = true, quoted = false;
    while (more) {
      quoted = text.charCodeAt(p) === 34;
      let value = '', junk = false;
      if (quoted) {
        const open = p, savedLine = line;
        let start = ++p, closed = false;
        while (p < n) {
          c = text.charCodeAt(p);
          if (c === 34) {
            value += text.slice(start, p);
            if (text.charCodeAt(p + 1) === 34) {
              value += '"'; p += 2; start = p;
            } else { p++; closed = true; break; }
          } else if (c === 13) {
            value += text.slice(start, p) + '\n';
            p += text.charCodeAt(p + 1) === 10 ? 2 : 1;
            start = p; line++;
          } else { if (c === 10) line++; p++; }
        }
        if (!closed) {
          p = open + 1; line = savedLine; value = '"';
          errors.push({code: 'unterminated_quote', line: recordLine, row: recordRow});
        } else junk = true;
      }
      let start = p, added = 0;
      for (;;) {
        if (comma < p) { comma = text.indexOf(',', p); if (comma < 0) comma = n; }
        if (lf < p) { lf = text.indexOf('\n', p); if (lf < 0) lf = n; }
        if (cr < p) { cr = text.indexOf('\r', p); if (cr < 0) cr = n; }
        let end = comma < lf ? comma : lf;
        if (cr < end) end = cr;
        added += end - start;
        value += text.slice(start, end);
        p = end;
        if (end === cr && end < n && text.charCodeAt(end + 1) !== 10) {
          errors.push({code: 'stray_cr', line: recordLine, row: recordRow});
          start = ++p; continue;
        }
        more = end < n && end === comma;
        if (end < n) {
          if (more) p++;
          else { p += end === cr ? 2 : 1; line++; }
        }
        break;
      }
      if (junk && added > 0) errors.push({code: 'quote_junk', line: recordLine, row: recordRow});
      fields.push(value);
    }
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = fields.length;
    if (isHeader) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({code: 'short_row', line: recordLine, row: recordRow, fields: fields.length});
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width)});
    }
    rows.push(fields);
  }
  return {columns: header ? (columns ?? []) : null, rows, errors};
}
