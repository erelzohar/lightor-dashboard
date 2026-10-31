/**
 * Copy to the clipboard: navigator.clipboard where the page may use it, else
 * the old select-and-copy. Says whether it worked, so nobody is told "copied"
 * when nothing was: an Android WebView refuses the first way outright
 * (NotAllowedError: Write permission denied, LT-501).
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused, or not a secure context: try the old way */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off to the side, and selectable although the body is user-select: none.
  area.style.cssText = 'position:fixed;top:0;opacity:0;-webkit-user-select:text;user-select:text';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length); // iOS selects nothing with select() alone
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
};
