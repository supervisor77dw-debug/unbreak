/**
 * Debug endpoint to check which code version is deployed
 */
export default function handler(req, res) {
  const buildInfo = {
    commit: 'a79c155',
    feature: 'orderPricingSnapshot in metadata only',
    timestamp: new Date().toISOString(),
    hasOrderPricingSnapshot: true,
    file: 'pages/api/checkout/standard.js',
    line334: 'const orderPricingSnapshot = {',
  };

  return res.status(200).json(buildInfo);
}
