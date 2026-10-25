// Extracts plain text from uploaded documents, in the browser, so they can be searched.
// Supports text files, PDFs with standard text streams, and Word (.docx). Best effort:
// scanned PDFs and unusual encodings simply return no text.
window.LegalDocs = (() => {
  const MAX_CHARS = 100000;
  const latin1 = (bytes) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return s;
  };

  async function inflate(bytes, format) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // ---------- PDF ----------

  // Reads string operands of the text operators Tj, TJ, ' and " from a content stream.
  function pdfStrings(content) {
    const out = [];
    const re = /\((?:\\.|[^\\)])*\)|\[(?:[^\]]*)\]\s*TJ|T\*|ET|Td|TD/g;
    let line = "";
    let m;
    while ((m = re.exec(content))) {
      const tok = m[0];
      if (tok === "ET" || tok === "T*" || tok === "Td" || tok === "TD") {
        if (line.trim()) out.push(line.trim());
        line = "";
      } else if (tok.startsWith("[")) {
        for (const part of tok.match(/\((?:\\.|[^\\)])*\)/g) || []) line += unescape(part);
      } else {
        line += unescape(tok);
      }
    }
    if (line.trim()) out.push(line.trim());
    return out.join("\n");
  }

  function unescape(lit) {
    return lit
      .slice(1, -1)
      .replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => {
        if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
        return { n: "\n", r: "", t: " ", b: "", f: "" }[c] ?? c;
      });
  }

  async function pdfText(bytes) {
    const raw = latin1(bytes);
    const parts = [];
    const re = /<<([\s\S]*?)>>\s*stream\r?\n/g;
    let m;
    while ((m = re.exec(raw))) {
      const start = m.index + m[0].length;
      const end = raw.indexOf("endstream", start);
      if (end < 0) break;
      const dict = m[1];
      if (/\/Subtype\s*\/Image|\/Type\s*\/XObject/.test(dict)) continue;
      // The line break before "endstream" isn't part of the data; decompressors reject it.
      let stop = end;
      while (stop > start && (bytes[stop - 1] === 10 || bytes[stop - 1] === 13)) stop--;
      let data = bytes.subarray(start, stop);
      try {
        if (/\/FlateDecode/.test(dict)) data = await inflate(data, "deflate");
        else if (/\/Filter/.test(dict)) continue;
      } catch {
        continue;
      }
      const text = pdfStrings(latin1(data));
      if (text) parts.push(text);
      if (parts.join("").length > MAX_CHARS) break;
    }
    return parts.join("\n");
  }

  // ---------- DOCX (zip) ----------

  async function zipEntry(bytes, name) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    let p = view.getUint32(eocd + 16, true);
    const count = view.getUint16(eocd + 10, true);
    for (let k = 0; k < count; k++) {
      if (view.getUint32(p, true) !== 0x02014b50) return null;
      const method = view.getUint16(p + 10, true);
      const size = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const local = view.getUint32(p + 42, true);
      const entry = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      if (entry === name) {
        const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = bytes.subarray(dataStart, dataStart + size);
        return method === 8 ? inflate(data, "deflate-raw") : data;
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  }

  async function docxText(bytes) {
    const xml = await zipEntry(bytes, "word/document.xml");
    if (!xml) return "";
    return new TextDecoder()
      .decode(xml)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }

  // ---------- Entry point ----------

  async function extractText(file, bytes) {
    const name = file.name.toLowerCase();
    try {
      let text = "";
      if ((file.type || "").startsWith("text/") || /\.(txt|md|csv|json|rtf)$/.test(name)) text = new TextDecoder().decode(bytes);
      else if (file.type === "application/pdf" || name.endsWith(".pdf")) text = await pdfText(bytes);
      else if (name.endsWith(".docx")) text = await docxText(bytes);
      return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_CHARS);
    } catch {
      return "";
    }
  }

  return { extractText };
})();
