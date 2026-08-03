import type { EventSink } from '@/contracts';
import { ConsoleEventSink } from './infrastructure/consoleSink';
export type { EventSink };
// TODO(seam-6, live): queue/analytics sink. Must stay off the critical path.
export function getEventSink(): EventSink { return new ConsoleEventSink(); }
