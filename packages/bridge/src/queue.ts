export interface QueueItem {
  id: string;
  execute: () => Promise<void>;
  retriesLeft: number;
  backoffMs: number;
}

export class ArchiveQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private maxRetries: number;
  private backoffMs: number;

  constructor(maxRetries: number = 3, backoffMs: number = 5000) {
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
  }

  enqueue(item: QueueItem): void {
    this.queue.push(item);
    this.process().catch(console.error);
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await item.execute();
      } catch (err) {
        if (item.retriesLeft > 0) {
          console.warn(`Queue item ${item.id} failed, ${item.retriesLeft} retries left:`, err);
          this.queue.push({
            ...item,
            retriesLeft: item.retriesLeft - 1,
            backoffMs: item.backoffMs * 2,
          });
          await new Promise((resolve) => setTimeout(resolve, item.backoffMs));
        } else {
          console.error(`Queue item ${item.id} failed after all retries:`, err);
        }
      }
    }

    this.processing = false;
  }

  get length(): number {
    return this.queue.length;
  }
}
