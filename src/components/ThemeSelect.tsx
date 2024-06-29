import clsx from "clsx";
import styles from "@styles/ThemeElements.module.scss";
import { useRef, useState } from "preact/hooks";
import ExpandMore from "@icons/expand_more_24dp.svg?react";

interface Option {
  name: string;
  value: string;
  disabled?: boolean;
}

export function ThemeSelect({
  options: loloptions,
  className,
  onChange,
  value,
  defaultValue,
}: {
  options: Option[];
  className?: string;
  onChange?: (mockEvent: { target: HTMLInputElement }) => void;
  value?: string;
  defaultValue?: string;
}) {
  // ref target
  const input = useRef<HTMLInputElement | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const [lastSelect, setLastSelect] = useState(-1);
  const [open, setOpen] = useState(false);

  const options: Option[] = [];
  const availableOptions: number[] = [];

  let defaultSelected = 0;

  for (const child of loloptions) {
    const option: Option = {
      name: child.name as string,
      value: child.value as string,
      disabled: child.disabled === true,
    };

    if (option.value === (value || defaultValue)) {
      defaultSelected = options.length;
    }

    if (!option.disabled) {
      availableOptions.push(options.length);
    }

    options.push(option);
  }

  const [selected, setSelected] = useState(defaultSelected);

  function setSelectedCB(value: number) {
    setSelected(value);
    setOpen(false);

    const i = input.current;

    if (!i) return;

    i.value = options[value]?.value || "";
    if (onChange) onChange({ target: i });
  }

  return (
    <div
      tabIndex={0}
      className={clsx(styles.ThemeSelect, className)}
      data-open={Number(open)}
      ref={container}
      onKeyDown={(event) => {
        let preventDefault = true;

        switch (event.code) {
          case "ArrowDown":
          case "ArrowUp":
            {
              const lastI = lastSelect;
              const lastIAvailable = availableOptions.indexOf(
                [...availableOptions].sort(
                  (a, b) => Math.abs(a - lastI) - Math.abs(b - lastI)
                )[0]
              );

              let next;

              switch (event.code) {
                case "ArrowDown":
                  if (lastIAvailable === availableOptions.length - 1) {
                    next = 0;
                  } else {
                    next = lastIAvailable + 1;
                    if (options[lastI].disabled) {
                      next--;
                    }
                  }
                  break;
                case "ArrowUp":
                  if (lastIAvailable === 0) {
                    next = availableOptions.length - 1;
                  } else {
                    next = lastIAvailable - 1;
                    if (options[lastI].disabled) {
                      next--;
                    }
                  }
                  break;
                // no default
              }

              const nextI = availableOptions[next];

              setLastSelect(nextI);

              if (!open) setSelectedCB(nextI);
            }
            break;
          case "Enter":
            if (open) setSelectedCB(lastSelect);
            else setOpen(true);
            break;
          case "Space":
            setOpen(true);
            break;
          default:
            preventDefault = false;
            break;
          // no default
        }

        if (preventDefault) {
          event.preventDefault();
        }
      }}
      onBlur={(event) => {
        if (
          !(event.target! as HTMLElement).contains(
            event.relatedTarget as HTMLElement
          )
        )
          setOpen(false);
      }}
    >
      <input ref={input} readOnly hidden />
      <div
        className={styles.toggle}
        onClick={() => {
          setOpen(!open);
          setLastSelect(selected);
          container.current?.focus();
        }}
      >
        <span>{options[selected]?.name}</span>
        <div dangerouslySetInnerHTML={{ __html: ExpandMore }} />
      </div>
      <div
        className={styles.list}
        onMouseLeave={() => {
          setLastSelect(-1);
        }}
      >
        {options.map((option, i) => (
          <div
            data-hover={i === lastSelect ? "1" : undefined}
            data-disabled={option.disabled ? "1" : undefined}
            key={i}
            onClick={() => {
              if (!option.disabled) {
                setSelectedCB(i);
              }
            }}
            onMouseOver={() => {
              if (!option.disabled) {
                setLastSelect(i);
              }
            }}
          >
            {option.name}
          </div>
        ))}
      </div>
    </div>
  );
}
