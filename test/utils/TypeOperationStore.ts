export enum Status {
  IDLE = 0,
  RUNNING_AUTO = 1,
  RUNNING_MANUAL = 2,
  FINISHED = 3,
  FAILED = 4,
  RECOVERED = 5,
  DEALLOCATED = 6,
}

export enum Queue {
  IDLE = 0,
  RUNNING = 1,
  FAILED = 2,
  NULL = 3,
}
