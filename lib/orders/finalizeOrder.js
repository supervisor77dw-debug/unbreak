/**
 * Helpers for finalizing a paid order from a Stripe checkout session.
 * Stripe may deliver the same event in parallel, so every step must be safe to run twice.
 */

const SHIPPING_ITEM_PATTERN = /^(versand|shipping)\b/i;

/**
 * Assign the final order number with compare-and-swap on the current value.
 * Only one caller wins; all others read back the stored number, so the database,
 * the success page and the emails always show the same one.
 * The loser's sequence value stays unused, which leaves a harmless gap.
 */
export async function assignOrderNumber(supabase, order, generateNumber) {
  const current = order.order_number;
  if (current && !current.startsWith('DRAFT-')) {
    return current;
  }

  let candidate;
  try {
    candidate = await generateNumber();
  } catch (error) {
    console.error('[ORDER_NUMBER] Generation failed:', error.message);
    candidate = `UO-${new Date().getFullYear()}-${order.id.substring(0, 8).toUpperCase()}`;
  }

  const update = supabase
    .from('simple_orders')
    .update({ order_number: candidate })
    .eq('id', order.id);
  const guarded = current ? update.eq('order_number', current) : update.is('order_number', null);
  const { data: claimed, error: claimError } = await guarded.select('order_number');
  if (claimError) throw claimError;
  if (claimed?.length) return candidate;

  const { data: stored, error: readError } = await supabase
    .from('simple_orders')
    .select('order_number')
    .eq('id', order.id)
    .single();
  if (readError) throw readError;
  return stored.order_number;
}

/**
 * The checkout sends shipping as a separate line item, so Stripe reports it inside
 * amount_subtotal and leaves shipping_cost empty.
 */
export function splitOrderAmounts(session, items, order) {
  const totalAmountCents = session.amount_total ?? order.total_amount_cents ?? 0;
  const shippingItem = items.find(item => SHIPPING_ITEM_PATTERN.test(item.name || ''));
  const shippingCents =
    session.shipping_cost?.amount_total || shippingItem?.totalPrice || order.shipping_cents || 0;

  return {
    totalAmountCents,
    shippingCents,
    subtotalCents: totalAmountCents - shippingCents,
  };
}

/** Language of the checkout, used for the customer email. */
export function resolveOrderLanguage(session) {
  const language = session.metadata?.ui_lang || session.locale || 'de';
  return language.toLowerCase().startsWith('en') ? 'en' : 'de';
}
