export function presentAboutBlank(src: string) {
  const newWindow = window.open("about:blank");
  if (!newWindow) throw new Error(`Could not create new window`);
  const dom = newWindow.document;
  dom.open();
  dom.write("<!doctype html><html></html>");
  const iframe = dom.createElement("iframe");
  iframe.src = src;
  // expand iframe to fit window
  iframe.style.border = "none";
  iframe.style.position = "absolute";
  iframe.style.top = "0px";
  iframe.style.left = "0px";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  dom.documentElement.append(iframe);
  dom.close();
}
