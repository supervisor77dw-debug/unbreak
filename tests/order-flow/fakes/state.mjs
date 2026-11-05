// State shared by the fakes and the tests. Each bundled handler gets its own copy of
// the fakes, so the state has to live on globalThis.
export function getState() {
  globalThis.__orderFlow ||= createState();
  return globalThis.__orderFlow;
}

export function createState() {
  return {
    tables: { simple_orders: [], webhook_logs: [] },
    nextOrderNumber: 200,
    hasEventColumn: true,
    failRpc: false,
    sessions: {},
    lineItems: {},
    sentMails: [],
    resendResponder: null,
    random: null,
  };
}

export function resetState() {
  globalThis.__orderFlow = createState();
  return globalThis.__orderFlow;
}
