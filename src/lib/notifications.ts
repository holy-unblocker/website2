import styles from "@styles/Notifications.module.scss";
import CheckCircle from "@icons/check_circle_24dp.svg?react";
import ErrorIcon from "@icons/error_24dp.svg?react";
import Info from "@icons/info_24dp.svg?react";
import Warning from "@icons/warning_24dp.svg?react";

const ANIMATION = 0.3e3;

// notifications container
const noticon = document.createElement("div");
noticon.className = styles.notifications;
document.body.append(noticon);

interface IconThing {
  icon: string;
  class: string;
}

const icons: Record<string, IconThing> = {
  warning: { icon: Warning, class: styles.warning },
  error: { icon: ErrorIcon, class: styles.error },
  success: { icon: CheckCircle, class: styles.success },
  info: { icon: Info, class: styles.info },
};

function resolveIcon(icon: string): IconThing {
  if (!(icon in icons)) throw new Error("Invalid icon");
  return icons[icon as keyof typeof icons];
}

const defaultNotiTime = 5e3;

export function createNotification(data: {
  title?: string;
  description?: string;
  type?: "warning" | "error" | "success" | "info";
  /**
   * in milliseconds
   */
  duration?: number;
}) {
  const e = document.createElement("div");
  e.className = styles.notification;
  if ("title" in data) e.classList.add(styles.title);

  const icon = resolveIcon(data.type || "info");
  e.insertAdjacentHTML("afterbegin", icon.icon);
  e.children[0].setAttribute("class", `${styles.icon} ${icon.class}`);

  const content = document.createElement("div");
  content.className = styles.content;
  e.append(content);

  if ("title" in data) {
    const title = document.createElement("div");
    title.textContent = data.title!;
    content.append(title);
  }

  if ("description" in data) {
    const desc = document.createElement("div");
    desc.textContent = data.description!;
    content.append(desc);
  }

  const duration = data.duration || defaultNotiTime;

  setTimeout(() => {
    e.classList.add(styles.hide);
    setTimeout(() => {
      e.remove();
    }, ANIMATION);
  }, duration);

  const timer = document.createElement("div");
  timer.className = styles.timer;
  timer.style.animationDuration = `${duration / 1000}s`;
  e.append(timer);

  noticon.append(e);
}
