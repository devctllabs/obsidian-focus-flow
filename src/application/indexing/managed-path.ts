const WORK_FOLDERS = new Set([
  'Inbox',
  'Epics',
  'Stories',
  'Tasks',
  'Distractions',
]);

function normalizeVaultPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
}

export function isManagedWorkNotePath(
  path: string,
  rootFolder: string,
): boolean {
  const root = normalizeVaultPath(rootFolder);
  const normalizedPath = normalizeVaultPath(path);
  const prefix = `${root}/`;
  if (
    !normalizedPath.startsWith(prefix) ||
    !normalizedPath.toLowerCase().endsWith('.md')
  ) {
    return false;
  }

  const segments = normalizedPath.slice(prefix.length).split('/');
  const folder = segments[0];
  return (
    (folder !== undefined && WORK_FOLDERS.has(folder)) ||
    folder === 'Sprints'
  );
}

export function isManagedIndexPath(
  path: string,
  rootFolder: string,
): boolean {
  const normalizedPath = normalizeVaultPath(path);
  const missionPath = `${normalizeVaultPath(rootFolder)}/MISSION.md`;
  return (
    normalizedPath === missionPath ||
    isManagedWorkNotePath(normalizedPath, rootFolder)
  );
}
