export function noteFilename(key: string, title: string): string {
  const sanitized = title
    .normalize('NFC')
    .replace(/[\p{Cc}/\\<>:"|?*]/gu, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return `${key} ${sanitized || 'Untitled'}.md`;
}
