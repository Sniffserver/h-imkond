/**
 * Binary Min-Heap Priority Queue for A* Pathfinding
 * 
 * Provides O(log n) insertions and extractions with O(1) lookups
 * and O(log n) priority updates (decrease-key).
 */

export interface HeapItem<T> {
  key: T;
  priority: number;
}

export class MinHeap<T = number> {
  private heap: HeapItem<T>[] = [];
  private keyToIndex: Map<T, number> = new Map();

  constructor(items?: { key: T; priority: number }[]) {
    if (items) {
      for (const item of items) {
        this.push(item.key, item.priority);
      }
    }
  }

  public get size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public has(key: T): boolean {
    return this.keyToIndex.has(key);
  }

  public getPriority(key: T): number | undefined {
    const idx = this.keyToIndex.get(key);
    if (idx === undefined) return undefined;
    return this.heap[idx]?.priority;
  }

  public push(key: T, priority: number): void {
    const existingIdx = this.keyToIndex.get(key);
    if (existingIdx !== undefined) {
      if (priority < this.heap[existingIdx].priority) {
        this.heap[existingIdx].priority = priority;
        this.bubbleUp(existingIdx);
      }
      return;
    }

    const item: HeapItem<T> = { key, priority };
    this.heap.push(item);
    const idx = this.heap.length - 1;
    this.keyToIndex.set(key, idx);
    this.bubbleUp(idx);
  }

  public pop(): HeapItem<T> | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) {
      const item = this.heap.pop()!;
      this.keyToIndex.delete(item.key);
      return item;
    }

    const root = this.heap[0];
    const last = this.heap.pop()!;
    this.keyToIndex.delete(root.key);

    this.heap[0] = last;
    this.keyToIndex.set(last.key, 0);
    this.sinkDown(0);

    return root;
  }

  public peek(): HeapItem<T> | undefined {
    return this.heap[0];
  }

  public clear(): void {
    this.heap = [];
    this.keyToIndex.clear();
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx].priority < this.heap[parentIdx].priority) {
        this.swap(idx, parentIdx);
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChildIdx = 2 * idx + 1;
      const rightChildIdx = 2 * idx + 2;
      let smallestIdx = idx;

      if (leftChildIdx < length && this.heap[leftChildIdx].priority < this.heap[smallestIdx].priority) {
        smallestIdx = leftChildIdx;
      }

      if (rightChildIdx < length && this.heap[rightChildIdx].priority < this.heap[smallestIdx].priority) {
        smallestIdx = rightChildIdx;
      }

      if (smallestIdx !== idx) {
        this.swap(idx, smallestIdx);
        idx = smallestIdx;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;

    this.keyToIndex.set(this.heap[i].key, i);
    this.keyToIndex.set(this.heap[j].key, j);
  }
}
