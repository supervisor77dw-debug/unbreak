import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resetState } from './fakes/state.mjs';

// The handlers log a lot; the log test below captures it on purpose
for (const level of ['log', 'info', 'warn', 'error']) console[level] = () => {};

const WEBHOOK_SECRETS = { test: 'whsec_sandbox_value', live: 'whsec_live_value' };

Object.assign(process.env, {
  STRIPE_WEBHOOK_SECRET: `${WEBHOOK_SECRETS.test}|${WEBHOOK_SECRETS.live}`,
  STRIPE_SECRET_KEY_TEST: 'sk_test_value',
  STRIPE_SECRET_KEY_LIVE: 'sk_live_value',
  STRIPE_SECRET_KEY: 'sk_test_value',
  RESEND_API_KEY: 're_secret_value',
  EMAIL_FROM_ORDERS: 'orders@unbreak-one.com',
  ADMIN_ORDER_EMAIL: 'orders@unbreak-one.com',
  SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role_value',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  DATABASE_URL: 'postgresql://user:db_password_value@localhost:1/db',
  DIRECT_URL: 'postgresql://user:db_password_value@localhost:1/db',
});

const load = name => import(pathToFileURL(join(process.env.ORDER_FLOW_BUILD, `${name}.mjs`)).href);
const webhook = (await load('webhook')).default;
const bySession = (await load('bySession')).default;
const retiredWebhook = (await load('retiredWebhook')).default;

const CUSTOMER = {
  email: 'kundin.geheim@example.org',
  name: 'Erika Geheimname',
  phone: '+4917012345678',
  address: { line1: 'Geheimstraße 12', city: 'Kiel', postal_code: '24116', country: 'DE' },
};

let state;
let serial = 0;

beforeEach(() => {
  state = resetState();
});

function callHandler(handler, { method = 'POST', headers = {}, rawBody, query = {} }) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader() {},
      json(body) {
        resolve({ status: this.statusCode, body });
        return this;
      },
    };
    Promise.resolve(handler({ method, headers, rawBody, query }, response)).catch(reject);
  });
}

function createOrder({ language = 'de', live = false, shippingName = 'Versand', items } = {}) {
  serial += 1;
  const sessionId = `cs_${live ? 'live' : 'test'}_${serial}`;
  const id = `0000000${serial}-aaaa-bbbb-cccc-000000000000`;
  const lineItems = items || [
    { name: 'Flexigel®-Untersetzer', quantity: 1, unit: 595, sku: 'Nana_Gel' },
  ];
  const stripeItems = [...lineItems, { name: shippingName, quantity: 1, unit: 490 }].map((item, i) => ({
    id: `li_${i}`,
    description: item.name,
    quantity: item.quantity,
    amount_total: item.unit * item.quantity,
    price: {
      id: `price_${i}`,
      unit_amount: item.unit,
      product: { name: item.name, metadata: item.sku ? { sku: item.sku } : {} },
    },
  }));
  const total = stripeItems.reduce((sum, item) => sum + item.amount_total, 0);

  state.tables.simple_orders.push({
    id,
    stripe_session_id: sessionId,
    order_number: `DRAFT-${id.substring(0, 8)}`,
    status: 'pending',
    email_status: 'pending',
    total_amount_cents: total,
    shipping_cents: 0,
    items: [],
    created_at: new Date().toISOString(),
    customer_email_sent_at: null,
    admin_email_sent_at: null,
  });
  state.lineItems[sessionId] = stripeItems;

  const session = {
    id: sessionId,
    object: 'checkout.session',
    payment_status: 'paid',
    payment_intent: 'pi_1',
    customer: 'cus_1',
    currency: 'eur',
    amount_total: total,
    amount_subtotal: total,
    locale: language,
    metadata: { order_id: id, ui_lang: language },
    customer_details: {
      email: CUSTOMER.email,
      name: CUSTOMER.name,
      phone: CUSTOMER.phone,
      address: CUSTOMER.address,
    },
  };
  state.sessions[sessionId] = session;
  return { id, session, live, eventId: `evt_${serial}` };
}

function deliver(order, { secret, eventId, type = 'checkout.session.completed' } = {}) {
  const signingSecret = secret ?? (order.live ? WEBHOOK_SECRETS.live : WEBHOOK_SECRETS.test);
  const event = {
    id: eventId || order.eventId,
    type,
    livemode: order.live,
    data: { object: order.session },
  };
  return callHandler(webhook, {
    headers: { 'stripe-signature': `signed:${signingSecret}` },
    rawBody: Buffer.from(JSON.stringify(event)),
  });
}

const stored = order => state.tables.simple_orders.find(row => row.id === order.id);
const customerMails = () => state.sentMails.filter(mail => [].concat(mail.to).includes(CUSTOMER.email));
const adminMails = () => state.sentMails.filter(mail => [].concat(mail.to).includes('orders@unbreak-one.com'));

test('normal order: status, number, amounts and both mails', async () => {
  const order = createOrder();
  const response = await deliver(order);

  assert.equal(response.status, 200);
  const row = stored(order);
  assert.equal(row.status, 'paid');
  assert.equal(row.order_number, 'UO-2026-000201');
  assert.equal(row.total_amount_cents, 1085);
  assert.equal(row.subtotal_cents, 595);
  assert.equal(row.shipping_cents, 490);
  assert.equal(row.email_status, 'sent');
  assert.equal(row.email_last_error ?? null, null);
  assert.equal(row.stripe_event_id, order.eventId);
  assert.equal(customerMails().length, 1);
  assert.equal(adminMails().length, 1);
  assert.equal(state.tables.simple_orders.length, 1);
});

test('customer mail: subject, product name and amounts', async () => {
  const order = createOrder();
  await deliver(order);

  const [mail] = customerMails();
  assert.match(mail.subject, /Ihre Bestellbestätigung/);
  assert.match(mail.subject, /UO-2026-000201/);
  assert.match(mail.html, /Flexigel®-Untersetzer/);
  assert.match(mail.html, /5,95/);
  assert.match(mail.html, /4,90/);
  assert.match(mail.html, /10,85/);
  assert.doesNotMatch(mail.html, /nano[ -]?gel/i);
});

test('admin mail: one tracked notification with positions and amounts', async () => {
  const order = createOrder();
  await deliver(order);

  assert.equal(adminMails().length, 1);
  const [mail] = adminMails();
  assert.match(mail.subject, /UO-2026-000201/);
  assert.match(mail.html, /Flexigel®-Untersetzer/);
  assert.match(mail.html, /Zwischensumme: €5\.95/);
  assert.match(mail.html, /Versand: €4\.90/);
  assert.notEqual(stored(order).admin_email_sent_at, null);
});

test('parallel deliveries: one number everywhere, one mail each', async () => {
  const order = createOrder();
  const responses = await Promise.all(Array.from({ length: 6 }, () => deliver(order)));

  responses.forEach(response => assert.equal(response.status, 200));
  const number = stored(order).order_number;
  assert.match(number, /^UO-2026-/);
  assert.equal(customerMails().length, 1);
  assert.equal(adminMails().length, 1);
  assert.ok(customerMails()[0].subject.includes(number), 'customer mail carries the stored number');
  assert.ok(adminMails()[0].subject.includes(number), 'admin mail carries the stored number');
  assert.equal(state.tables.simple_orders.length, 1);
  assert.equal(stored(order).email_status, 'sent');
});

test('parallel deliveries under random timing: 200 rounds stay consistent', async () => {
  let seed = 20261105;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let round = 0; round < 200; round++) {
    state = resetState();
    state.random = random;
    const order = createOrder();
    await Promise.all([deliver(order), deliver(order), deliver(order, { eventId: 'evt_other' })]);

    const number = stored(order).order_number;
    assert.equal(customerMails().length, 1, `round ${round}: customer mails`);
    assert.equal(adminMails().length, 1, `round ${round}: admin mails`);
    assert.ok(customerMails()[0].subject.includes(number), `round ${round}: customer mail number`);
    assert.ok(adminMails()[0].subject.includes(number), `round ${round}: admin mail number`);
  }
});

test('parallel deliveries of two different event ids stay consistent', async () => {
  const order = createOrder();
  await Promise.all([deliver(order, { eventId: 'evt_a' }), deliver(order, { eventId: 'evt_b' })]);

  const number = stored(order).order_number;
  assert.equal(customerMails().length, 1);
  assert.ok(customerMails()[0].subject.includes(number));
});

test('success page shows the stored number and no name or address', async () => {
  const order = createOrder();
  await Promise.all([deliver(order), deliver(order)]);

  const page = await callHandler(bySession, {
    method: 'GET',
    query: { session_id: order.session.id },
  });
  assert.equal(page.body.order_number, stored(order).order_number);
  assert.ok(customerMails()[0].subject.includes(page.body.order_number));
  assert.equal(page.body.customer_name, undefined);
  assert.equal(page.body.shipping_address, undefined);
});

test('repeated event: skipped, nothing changes', async () => {
  const order = createOrder();
  await deliver(order);
  const before = structuredClone(stored(order));

  const response = await deliver(order);

  assert.equal(response.status, 200);
  assert.equal(response.body.duplicate, true);
  assert.deepEqual(stored(order), before);
  assert.equal(state.sentMails.length, 2);
});

test('without migration 021: flow, replay and parallel delivery still work', async () => {
  state.hasEventColumn = false;
  const order = createOrder();

  const responses = await Promise.all([deliver(order), deliver(order)]);
  responses.forEach(response => assert.equal(response.status, 200));
  const replay = await deliver(order);

  assert.equal(replay.status, 200);
  assert.equal(stored(order).email_status, 'sent');
  assert.equal(customerMails().length, 1);
  assert.equal(adminMails().length, 1);
});

test('customer mail failure: 500 for Stripe retry, then recovery without duplicates', async () => {
  const order = createOrder();
  state.resendResponder = mail =>
    [].concat(mail.to).includes(CUSTOMER.email) ? { message: 'temporary outage', statusCode: 500 } : null;

  const first = await deliver(order);

  assert.equal(first.status, 500);
  assert.equal(stored(order).email_status, 'partial');
  assert.match(stored(order).email_last_error, /temporary outage/);
  assert.equal(stored(order).customer_email_sent_at, null);
  assert.equal(adminMails().length, 1);

  state.resendResponder = null;
  const second = await deliver(order);

  assert.equal(second.status, 200);
  assert.equal(stored(order).email_status, 'sent');
  assert.equal(stored(order).email_last_error, null);
  assert.equal(customerMails().length, 1);
  assert.equal(adminMails().length, 1);
});

test('admin mail failure: retry sends only the admin mail and clears the error', async () => {
  const order = createOrder();
  state.resendResponder = mail =>
    mail.subject.includes('Neue Bestellung') ? { message: 'not authorized', statusCode: 403 } : null;

  const first = await deliver(order);
  assert.equal(first.status, 500);
  assert.match(stored(order).email_last_error, /not authorized/);

  state.resendResponder = null;
  const second = await deliver(order);

  assert.equal(second.status, 200);
  assert.equal(customerMails().length, 1);
  assert.equal(adminMails().length, 1);
  assert.equal(stored(order).email_last_error, null);
});

test('number sequence failure: fallback number is used consistently', async () => {
  state.failRpc = true;
  const order = createOrder();

  const response = await deliver(order);

  assert.equal(response.status, 200);
  assert.doesNotMatch(stored(order).order_number, /^DRAFT-/);
  assert.ok(customerMails()[0].subject.includes(stored(order).order_number));
});

test('several positions and EN shipping label: amounts split correctly', async () => {
  const order = createOrder({
    shippingName: 'Shipping',
    items: [
      { name: 'Flexigel®-Untersetzer', quantity: 2, unit: 595, sku: 'Nana_Gel' },
      { name: 'Glashalter Universal', quantity: 1, unit: 1990, sku: 'UNBREAK-GLAS-01' },
    ],
  });

  await deliver(order);

  assert.equal(stored(order).total_amount_cents, 3670);
  assert.equal(stored(order).subtotal_cents, 3180);
  assert.equal(stored(order).shipping_cents, 490);
});

test('English checkout: English mail with the same Flexigel® name', async () => {
  const order = createOrder({ language: 'en', shippingName: 'Shipping' });
  await deliver(order);

  const [mail] = customerMails();
  assert.match(mail.subject, /Your order confirmation/);
  assert.match(mail.html, /Flexigel®-Untersetzer/);
  assert.doesNotMatch(mail.html, /Vielen Dank/);
});

test('sandbox events are marked as test, live events are not', async () => {
  const sandbox = createOrder();
  await deliver(sandbox);
  assert.match(customerMails()[0].subject, /^\[TEST\] /);
  assert.match(adminMails()[0].subject, /TEST/);

  state.sentMails.length = 0;
  const live = createOrder({ live: true });
  await deliver(live);
  assert.doesNotMatch(customerMails()[0].subject, /TEST/);
  assert.doesNotMatch(adminMails()[0].subject, /TEST/);
});

test('signature: wrong or missing secret is rejected and changes nothing', async () => {
  const order = createOrder();

  const wrong = await deliver(order, { secret: 'whsec_forged' });
  const missing = await callHandler(webhook, { headers: {}, rawBody: Buffer.from('{}') });

  assert.equal(wrong.status, 400);
  assert.equal(missing.status, 400);
  assert.equal(stored(order).status, 'pending');
  assert.equal(state.sentMails.length, 0);
});

test('both configured secrets verify: sandbox and live', async () => {
  const sandbox = await deliver(createOrder());
  const live = await deliver(createOrder({ live: true }));

  assert.equal(sandbox.status, 200);
  assert.equal(live.status, 200);
  assert.equal(live.body.mode, 'LIVE');
});

test('unhandled live event proves signature without touching orders', async () => {
  const order = createOrder({ live: true });
  const response = await deliver(order, { type: 'product.updated' });

  assert.equal(response.status, 200);
  assert.equal(stored(order).status, 'pending');
  assert.equal(state.sentMails.length, 0);
});

test('session without order: 500 for retry, no mail', async () => {
  const order = createOrder();
  state.tables.simple_orders.length = 0;

  const response = await deliver(order);

  assert.equal(response.status, 500);
  assert.equal(state.sentMails.length, 0);
});

test('logs contain no customer data and no secrets', async () => {
  const lines = [];
  const original = {};
  for (const level of ['log', 'warn', 'error', 'info']) {
    original[level] = console[level];
    console[level] = (...args) => lines.push(args.map(arg =>
      typeof arg === 'string' ? arg : JSON.stringify(arg, (key, value) => (value instanceof Error ? value.stack : value))
    ).join(' '));
  }
  try {
    const order = createOrder();
    await Promise.all([deliver(order), deliver(order)]);
    await deliver(order, { secret: 'whsec_forged' });
  } finally {
    Object.assign(console, original);
  }

  const output = lines.join('\n');
  assert.ok(output.length > 1000, 'the flow really logged');
  for (const value of [
    CUSTOMER.email, CUSTOMER.name, CUSTOMER.phone, CUSTOMER.address.line1,
    WEBHOOK_SECRETS.test, WEBHOOK_SECRETS.live, 'sk_live_value', 'sk_test_value',
    're_secret_value', 'service_role_value', 'db_password_value',
  ]) {
    const leaks = lines.filter(line => line.includes(value));
    assert.equal(leaks.length, 0, `log leaks ${value}: ${leaks[0]?.slice(0, 160)}`);
  }
});

test('retired webhook answers 410 and never touches orders', async () => {
  const order = createOrder();
  const response = await callHandler(retiredWebhook, { rawBody: Buffer.from('{}') });

  assert.equal(response.status, 410);
  assert.equal(stored(order).status, 'pending');
});
