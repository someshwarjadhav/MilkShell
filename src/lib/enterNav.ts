import type * as React from "react";

/**
 * Enter-key entry, like SmartX: Enter in a text / number box moves the cursor to the next box of the same form;
 * Enter in the LAST box runs `onLast` (normally Submit). Put it on the wrapper of the form fields:
 *
 *   <div onKeyDown={(e) => enterNext(e, submit)}> ...inputs... </div>
 *
 * Read-only boxes (CLR, Rate, Amount), disabled boxes, buttons and the search box of a dropdown list are skipped.
 */
export function enterNext(
  e: React.KeyboardEvent<HTMLElement>,
  onLast?: () => void,
): void {
  if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.nativeEvent.isComposing) return;
  const target = e.target as HTMLElement;
  if (!(target instanceof HTMLInputElement)) return;
  const root = e.currentTarget;
  // dropdown lists are drawn in a portal: their keys are not ours
  if (!root.contains(target)) return;
  if (["button", "submit", "checkbox", "radio", "file"].includes(target.type)) return;

  const boxes = Array.from(
    root.querySelectorAll<HTMLInputElement>("input"),
  ).filter(
    (el) =>
      !el.readOnly &&
      !el.disabled &&
      el.tabIndex !== -1 &&
      el.type !== "hidden" &&
      el.offsetParent !== null,
  );
  const at = boxes.indexOf(target);
  if (at < 0) return;
  e.preventDefault();
  const next = boxes[at + 1];
  if (next) {
    next.focus();
    try {
      next.select();
    } catch {
      /* date / number boxes may refuse select() */
    }
  } else onLast?.();
}
