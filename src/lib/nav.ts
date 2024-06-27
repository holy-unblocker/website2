window.setNavExpanded = (expanded) => {
  if (expanded) {
    document.documentElement.dataset.expanded = "1";
  } else {
    delete document.documentElement.dataset.expanded;
  }
};

function getNavExpanded() {
  return document.documentElement.dataset.expanded === "1";
}

function keydown(event: KeyboardEvent) {
  if (getNavExpanded() && event.key === "Escape") {
    setNavExpanded(false);
  }
}

document.addEventListener("keydown", keydown);

for (const t of document.querySelectorAll(".menuitem"))
  t.addEventListener("click", () => {
    setNavExpanded(false);
  });

document
  .querySelector<HTMLButtonElement>("#toggle-nav")!
  .addEventListener("click", () => {
    setNavExpanded(true);
  });
