export function presentAboutBlank(src: string) {
  const n = window.open("about:blank");
  if (n === null) throw new Error("Could not create about:blank window");
  const dom = n.document;
  dom.open();
  dom.write(
    `<!doctype html><html><body><iframe style="border:0;position:fixed;top:0;left:0;width:100%;height:100%" id="tool" src="${src}"></iframe><script>window.onfocus=()=>tool.contentWindow.focus()</script></body></html>`,
  );
  dom.close();
}
