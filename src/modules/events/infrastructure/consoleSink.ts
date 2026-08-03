import type { EventSink, DomainEvent } from '@/contracts';
export class ConsoleEventSink implements EventSink {
  emit(event: DomainEvent): void {
    // Fire-and-forget. Never throws into the caller's critical path.
    try { console.info('[event]', event.kind, event); } catch { /* ignore */ }
  }
}
