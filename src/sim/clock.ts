export interface SimTime {
  day: number;
  hour: number;
  minute: number;
}

export class SimClock {
  private accumulator = 0;

  constructor(private time: SimTime) {}

  update(dtSeconds: number): number {
    const simMinutes = dtSeconds;
    this.accumulator += simMinutes;
    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      this.advanceMinute();
    }
    return simMinutes;
  }

  getTime(): SimTime {
    return this.time;
  }

  private advanceMinute(): void {
    this.time.minute += 1;
    if (this.time.minute >= 60) {
      this.time.minute = 0;
      this.time.hour += 1;
      if (this.time.hour >= 24) {
        this.time.hour = 0;
        this.time.day += 1;
      }
    }
  }
}

export function formatSimTime(time: SimTime): string {
  const hour = pad2(time.hour);
  const minute = pad2(time.minute);
  return `Day ${time.day} ${hour}:${minute}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
