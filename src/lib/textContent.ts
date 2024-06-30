/**
 * Sanitizes raw HTML using native APIs
 */
export default function getTextContent(html: string) {
  const buffer = document.createElement("div");
  buffer.innerHTML = html;
  const { textContent } = buffer;
  buffer.innerHTML = "";
  return textContent!;
}
