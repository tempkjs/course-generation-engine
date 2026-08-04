import type { EventSink, DomainEvent } from "@/contracts";
export class ConsoleEventSink implements EventSink {
  emit(event: DomainEvent): void {
    // Fire-and-forget. Never throws into the caller's critical path.
    try {
      // eslint-disable-next-line no-console -- this IS the mock sink (Seam 6 "emit to console")
      console.info("[event]", event.kind, event);
    } catch {
      /* ignore */
    }
  }
}
