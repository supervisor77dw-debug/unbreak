import { getState } from './state.mjs';

export class Resend {
  constructor() {
    this.emails = {
      send: async mail => {
        await new Promise(resolve => setImmediate(resolve));
        const state = getState();
        const failure = state.resendResponder?.(mail);
        if (failure) return { data: null, error: failure };
        state.sentMails.push(mail);
        return { data: { id: `mail_${state.sentMails.length}` }, error: null };
      },
    };
  }
}
