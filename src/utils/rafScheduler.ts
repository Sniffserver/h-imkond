/**
 * Unified requestAnimationFrame (RAF) Scheduler
 *
 * Runs a single continuous 60fps animation loop. Components, canvases, and
 * physics routines register draw/tick callbacks here instead of each component
 * spinning its own independent requestAnimationFrame loop.
 */

export type RafCallback = (timestamp: number, deltaTime: number) => void;

interface RegisteredTask {
  id: string;
  callback: RafCallback;
  priority: number;
}

class RafScheduler {
  private tasks: Map<string, RegisteredTask> = new Map();
  private sortedTasks: RegisteredTask[] = [];
  private rafId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  /**
   * Register a callback to run on every animation frame.
   * @param id Unique identifier for the callback
   * @param callback Function to execute on each frame with (timestamp, deltaTimeMs)
   * @param priority Lower numbers run earlier in the frame (default: 0)
   * @returns Unsubscribe function
   */
  public register(id: string, callback: RafCallback, priority: number = 0): () => void {
    this.tasks.set(id, { id, callback, priority });
    this.updateSortedTasks();

    if (!this.isRunning && this.tasks.size > 0) {
      this.start();
    }

    return () => this.unregister(id);
  }

  /**
   * Unregister a previously registered callback.
   */
  public unregister(id: string): void {
    if (this.tasks.delete(id)) {
      this.updateSortedTasks();
    }

    if (this.tasks.size === 0 && this.isRunning) {
      this.stop();
    }
  }

  /**
   * Check if a task is currently registered.
   */
  public has(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Re-sort task list by priority.
   */
  private updateSortedTasks(): void {
    this.sortedTasks = Array.from(this.tasks.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Start the single master RAF loop.
   */
  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;

      const deltaTime = this.lastTime > 0 ? Math.min(100, timestamp - this.lastTime) : 16.67;
      this.lastTime = timestamp;

      // Execute all registered tasks
      const currentTasks = this.sortedTasks;
      for (let i = 0; i < currentTasks.length; i++) {
        const task = currentTasks[i];
        try {
          task.callback(timestamp, deltaTime);
        } catch (error) {
          console.error(`[rafScheduler] Error in task "${task.id}":`, error);
        }
      }

      if (this.isRunning && this.tasks.size > 0) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.isRunning = false;
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop the master RAF loop.
   */
  private stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTime = 0;
  }

  /**
   * Get the count of active registered callbacks.
   */
  public getTaskCount(): number {
    return this.tasks.size;
  }
}

export const rafScheduler = new RafScheduler();
