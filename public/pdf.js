// Minimal text-only PDF writer (Letter size, Helvetica), so exports work without a
// third-party library. Every page can carry the privilege label at the top and a
// page footer at the bottom.
window.LegalPDF = (() => {
  const W = 612;
  const H = 792;
  const M = 56;
  const LEAD = 1.45;
  const LABEL = "PRIVILEGED & CONFIDENTIAL - ATTORNEY-CLIENT COMMUNICATION / ATTORNEY WORK PRODUCT";

  // The built-in fonts use WinAnsi, so map common typographic characters and drop the rest.
  const clean = (s) =>
    String(s ?? "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[  ]/g, " ")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Approximate Helvetica advance widths, close enough for line wrapping.
  function width(s, size) {
    let w = 0;
    for (const c of s) {
      if (/[il.,;:'|!\s]/.test(c)) w += 0.28;
      else if (/[mwMW]/.test(c)) w += 0.85;
      else if (/[A-Z]/.test(c)) w += 0.68;
      else if (/[0-9]/.test(c)) w += 0.556;
      else w += 0.52;
    }
    return w * size;
  }

  function wrap(text, size, max) {
    const lines = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (let word of para.split(/ +/)) {
        while (width(word, size) > max) {
          // Hard-split words that can't fit on one line (hashes, long URLs).
          let cut = word.length;
          while (cut > 1 && width(word.slice(0, cut), size) > max) cut--;
          if (line) { lines.push(line); line = ""; }
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        const next = line ? `${line} ${word}` : word;
        if (width(next, size) > max && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function create({ title, privileged = true }) {
    const pages = [];
    let ops;
    let y;
    const top = H - M - (privileged ? 14 : 0);

    const newPage = () => {
      ops = [];
      pages.push(ops);
      y = top;
    };
    const ensure = (h) => { if (y - h < M + 16) newPage(); };
    const put = (str, x, size, bold, gray) =>
      ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${gray ? "0.42 0.42 0.45 rg" : "0.08 0.08 0.1 rg"} ${x} ${y.toFixed(2)} Td (${esc(str)}) Tj ET`);

    newPage();

    const doc = {
      text(t, { size = 10, bold = false, gray = false, indent = 0, gap = 4 } = {}) {
        for (const line of wrap(clean(t), size, W - 2 * M - indent)) {
          ensure(size * LEAD);
          y -= size * LEAD;
          put(line, M + indent, size, bold, gray);
        }
        y -= gap;
        return doc;
      },
      heading(t, size = 16) {
        y -= 4;
        return doc.text(t, { size, bold: true, gap: 6 });
      },
      kv(pairs, keyWidth = 150) {
        for (const [k, v] of pairs) {
          const lines = wrap(clean(v), 10, W - 2 * M - keyWidth);
          ensure(lines.length * 14 + 2);
          y -= 14;
          put(clean(k), M, 10, true, true);
          lines.forEach((l, i) => {
            if (i) y -= 14;
            put(l, M + keyWidth, 10, false, false);
          });
          y -= 3;
        }
        y -= 6;
        return doc;
      },
      rule() {
        ensure(14);
        y -= 7;
        ops.push(`0.82 0.82 0.85 RG 0.6 w ${M} ${y.toFixed(2)} m ${W - M} ${y.toFixed(2)} l S`);
        y -= 7;
        return doc;
      },
      space(n = 8) {
        y -= n;
        return doc;
      },
      blob() {
        return new Blob([Uint8Array.from(build(pages, clean(title), privileged), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      },
      save(filename) {
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(doc.blob()), download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      },
    };
    return doc;
  }

  function build(pages, title, privileged) {
    const objs = [];
    const add = (body) => objs.push(body) && objs.length;
    add("<< /Type /Catalog /Pages 2 0 R >>");
    add(null); // pages, filled in below
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const info = add(`<< /Title (${esc(title)}) /Producer (legal.xyz) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z) >>`);

    const kids = pages.map((ops, i) => {
      const chrome = [];
      if (privileged) chrome.push(`BT /F2 7.5 Tf 0.55 0.2 0.2 rg ${M} ${H - 36} Td (${esc(LABEL)}) Tj ET`);
      chrome.push(`BT /F1 8 Tf 0.42 0.42 0.45 rg ${M} 30 Td (${esc(`${title} - legal.xyz - page ${i + 1} of ${pages.length}`)}) Tj ET`);
      const stream = [...chrome, ...ops].join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`);
    });
    objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { out += `${String(o).padStart(10, "0")} 00000 n \n`; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return out;
  }

  // The signed privilege agreement with its audit trail, for counsel and client records.
  function agreement(p) {
    const doc = create({ title: "Privilege agreement" });
    doc.heading("Privilege agreement", 18)
      .text(`${p.company} and ${p.signer || p.lawyerName} (${p.firm})`, { gray: true })
      .rule()
      .text(p.agreementText || "Agreement text unavailable for agreements signed before records were kept.", { size: 10.5, gap: 8 })
      .rule()
      .heading("Audit trail", 13)
      .kv([
        ["Client", `${p.company} (${p.name}, ${p.email})`],
        ["Agreement sent to", p.lawyerEmail],
        ["Sent", p.invitedAt ? new Date(p.invitedAt).toLocaleString() : "-"],
        ["Signed by", p.signer || "-"],
        ["Bar number", p.bar ? `${p.bar} (${p.barState}) - ${p.barStatus === "verified" ? "verified" : "verification pending"}` : "-"],
        ["Signed", p.signedAt ? new Date(p.signedAt).toLocaleString() : "Not signed"],
        ["Ended", p.revokedAt ? new Date(p.revokedAt).toLocaleString() : "-"],
        ["Signature method", "Electronic signature by checkbox and typed name"],
        ["Agreement SHA-256", p.agreementHash || "-"],
      ]);
    return doc;
  }

  return { create, agreement };
})();
