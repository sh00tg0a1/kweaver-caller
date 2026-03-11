export function decodeHtmlEntities(s: string): string {
  let current = s;

  for (let i = 0; i < 5; i += 1) {
    const decoded = current
      .replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&quot;/g, "\"")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");

    if (decoded === current) {
      break;
    }
    current = decoded;
  }

  return current;
}

export function stripHtmlComments(s: string): string {
  if (s.trimStart().startsWith("<!--")) {
    return "";
  }

  return s.replace(/<!--[\s\S]*?-->/g, "").trim();
}

export function normalizeDisplayText(s: string): string {
  return decodeHtmlEntities(stripHtmlComments(s));
}
