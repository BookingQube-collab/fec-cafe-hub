// Fire-and-forget work after the response finishes (audit rows, cleanup).
export function deferRequestTask(task: Promise<unknown>) {
  return task.catch(error => console.error('Deferred request task failed', { type: error?.name, code: error?.code }));
}
