export class PathRefreshBatcher {
  private readonly paths = new Set<string>();
  private timer: number | null = null;

  constructor(
    private readonly refresh: (paths: readonly string[]) => void,
    private readonly delayMs = 100,
  ) {}

  schedule(...paths: readonly string[]): void {
    for (const path of paths) this.paths.add(path);
    if (this.timer !== null) return;

    this.timer = window.setTimeout(() => {
      this.timer = null;
      const batch = [...this.paths];
      this.paths.clear();
      this.refresh(batch);
    }, this.delayMs);
  }

  dispose(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.paths.clear();
  }
}
