/** Trigger a browser download of text content. Local app only; nothing is uploaded. */
export function downloadText(fileName: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
