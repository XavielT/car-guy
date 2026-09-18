/**
 * Web: there is no PDF to hand over.
 *
 * `expo-print`'s `printToFileAsync` on web does not return a file — it opens
 * the browser's print dialog and resolves with nothing usable — and its
 * `printAsync` prints *the current page*, which would produce a screenshot of
 * the app rather than the report. So the web path renders the report into a
 * hidden same-origin iframe and prints that: the user then picks "Save as PDF"
 * in the dialog, which every desktop browser offers and which the screen says
 * out loud.
 */
export type PrintResult = 'shared' | 'printed' | 'unavailable';

export async function printReport(html: string): Promise<PrintResult> {
  const frame = document.createElement('iframe');
  // Off-screen rather than display:none — a hidden iframe has no layout in some
  // browsers and prints a blank page.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return 'unavailable';
  }

  doc.open();
  doc.write(html);
  doc.close();

  // The document has to have laid out before print(), or Safari and Firefox
  // send an empty page.
  await new Promise<void>((resolve) => {
    if (doc.readyState === 'complete') resolve();
    else frame.contentWindow?.addEventListener('load', () => resolve(), { once: true });
    setTimeout(resolve, 600);
  });

  frame.contentWindow.focus();
  frame.contentWindow.print();

  // Chrome's print dialog is modal but asynchronous; removing the frame too
  // early cancels it.
  setTimeout(() => frame.remove(), 60_000);
  return 'printed';
}
