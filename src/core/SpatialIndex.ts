/** Bounds are indexed once per step for moving bodies, once per map for walls. */
export class SpatialIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly seen = new Set<number>();
  private readonly result: number[] = [];
  private readonly cellSize: number;
  constructor(cellSize = 128) {
    this.cellSize = cellSize;
  }
  clear(): void {
    for (const cell of this.cells.values()) cell.length = 0;
  }
  insert(id: number, x1: number, y1: number, x2 = x1, y2 = y1): void {
    for (let y = Math.floor(Math.min(y1, y2) / this.cellSize); y <= Math.floor(Math.max(y1, y2) / this.cellSize); y++)
      for (
        let x = Math.floor(Math.min(x1, x2) / this.cellSize);
        x <= Math.floor(Math.max(x1, x2) / this.cellSize);
        x++
      ) {
        const key = `${x}:${y}`;
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(id);
      }
  }
  query(x1: number, y1: number, x2: number, y2: number): readonly number[] {
    this.result.length = 0;
    this.seen.clear();
    for (let y = Math.floor(y1 / this.cellSize); y <= Math.floor(y2 / this.cellSize); y++)
      for (let x = Math.floor(x1 / this.cellSize); x <= Math.floor(x2 / this.cellSize); x++)
        for (const id of this.cells.get(`${x}:${y}`) ?? [])
          if (!this.seen.has(id)) {
            this.seen.add(id);
            this.result.push(id);
          }
    return this.result;
  }
}
