"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useSiteCopy } from "./site-copy-provider";
import { Icon } from "./icons";

type TopicOption = { value: string; label: string; count: number };

export default function TopicMenu({ options, value, onChange, disabled }: {
  options: TopicOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useSiteCopy();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const expanded = open && !disabled;

  useEffect(() => {
    if (!expanded) return;
    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [expanded]);

  useEffect(() => {
    if (expanded) root.current?.querySelector(`[data-option-index="${highlight}"]`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, highlight]);

  function choose(index: number) {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 :
        !expanded ? selected : (highlight + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      setHighlight(next);
      setOpen(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (expanded) choose(highlight);
      else { setHighlight(selected); setOpen(true); }
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - typeahead.current.time < 700 ? typeahead.current.text : "") + event.key.toLowerCase();
      typeahead.current = { text, time: now };
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
      if (index !== -1) { setHighlight(index); setOpen(true); }
    }
  }

  return (
    <div className="topic-filter" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <span id={`${id}-label`}>{t("Topic")}</span>
      <div className="topic-menu" data-open={expanded}>
        <button ref={trigger} type="button" role="combobox" className="topic-trigger"
          aria-labelledby={`${id}-label ${id}-value`} aria-expanded={expanded} aria-haspopup="listbox"
          aria-controls={`${id}-list`} aria-activedescendant={expanded ? `${id}-option-${highlight}` : undefined}
          disabled={disabled} onKeyDown={onKeyDown}
          onClick={() => { setHighlight(selected); setOpen(!expanded); }}>
          <span id={`${id}-value`} title={options[selected]?.label}>{options[selected]?.label}</span>
          <Icon name="chevron" />
        </button>
        <div className="topic-popover" aria-hidden={!expanded} inert={!expanded}>
          <div className="topic-menu-heading">{t("Topics")}<span>{options.length - 1}</span></div>
          <div id={`${id}-list`} className="topic-options" role="listbox" aria-labelledby={`${id}-label`}>
            {options.map((option, index) => (
              <div key={option.value} id={`${id}-option-${index}`} role="option"
                aria-selected={option.value === value} data-option-index={index}
                className={`topic-option ${highlight === index ? "is-highlighted" : ""}`}
                onPointerMove={() => setHighlight(index)} onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}>
                <span className="topic-option-check">{option.value === value && <Icon name="check" />}</span>
                <span className="topic-option-label">{option.label}</span>
                <span className="topic-option-count">{option.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
