// CommonJS because lib/stripe-config.js loads Stripe with require().
// constructEvent accepts the signature "signed:<secret>", which lets the tests choose
// which configured webhook secret an event was signed with.
class Stripe {
  constructor(key) {
    this.key = key;
    this.webhooks = {
      constructEvent(body, signature, secret) {
        if (signature !== `signed:${secret}`) {
          throw new Error('No signatures found matching the expected signature');
        }
        return JSON.parse(body.toString());
      },
    };
    this.checkout = {
      sessions: {
        listLineItems: async sessionId => ({
          data: globalThis.__orderFlow.lineItems[sessionId] || [],
        }),
        retrieve: async sessionId => globalThis.__orderFlow.sessions[sessionId],
      },
    };
  }
}

module.exports = Stripe;
module.exports.default = Stripe;
