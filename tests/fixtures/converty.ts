export const storeId = '69e9d7c9fef2de95043ee3ba';
export const productId = '111111111111111111111111';
export const secondId = '222222222222222222222222';
export function mockConverty() {
  let now = Date.now(); let mode = 'ok'; let creates = 0; let refreshes = 0; let lastOrder: any;
  const store = { _id: storeId, name: 'ARIMA', slug: 'arima', currency: { code: 'TND', decimals: 3 }, country: { code: 'TN', subdivisions: ['Tunis', 'Ariana', 'Sfax'] }, checkout: { fields: [{ name: 'name', required: true }, { name: 'phone', required: true }, { name: 'city', required: true }, { name: 'address', required: true }] } };
  const products: any[] = [
    { _id: productId, store: storeId, name: 'Cheesecake Fraise', slug: 'cheesecake-fraise', description: '<p>Crème douce et fraise.</p>', price: 8.5, cost: 1.5, deliveryPrice: 8, deliveryCost: 6, status: 'shown', images: [], categories: ['cheese'], trackStock: true, newStock: { quantity: 20 }, allowQuantityButton: true },
    { _id: secondId, store: storeId, name: 'Tiramisu Pistache', slug: 'tiramisu-pistache', description: 'Une touche de pistache.', price: 10, cost: 2, deliveryPrice: 8, deliveryCost: 6, status: 'shown', images: [], categories: ['tira'], trackStock: false, allowQuantityButton: true },
  ];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); let data: any; let status = 200;
    if (url.origin === 'https://partner.converty.shop' && url.pathname === '/oauth2/token') {
      const body = new URLSearchParams(String(init?.body));
      if (body.get('grant_type') === 'refresh_token') refreshes++;
      if (body.get('client_secret') !== 'server-only-secret') return Response.json({ error: 'invalid_client' }, { status: 401 });
      return Response.json({ access_token: 'mock-access-token-secret', refresh_token: 'mock-refresh-token-secret', expires_in: 1296000 });
    }
    if (url.origin !== 'https://api.converty.shop') throw new Error('Unexpected destination');
    if (new Headers(init?.headers).get('Authorization') !== 'Bearer mock-access-token-secret') return Response.json({}, { status: 401 });
    switch (url.pathname) {
      case '/api/v1/stores/me': data = store; break;
      case '/api/v1/categories': data = [{ _id: 'cheese', name: 'Cheesecakes' }, { _id: 'tira', name: 'Tiramisus' }]; break;
      case '/api/v1/products': return Response.json({ success: true, data: products, count: products.length });
      case '/api/v1/orders':
        creates++; lastOrder = JSON.parse(String(init?.body));
        await new Promise(resolve => setTimeout(resolve, 30));
        if (mode === 'uncertain') throw new Error('Network ended after vendor acceptance');
        if (mode === 'reject') return Response.json({ success: false }, { status: 422 });
        data = { reference: 1082, total: lastOrder.total }; status = 201; break;
      default:
        data = products.find(p => `/api/v1/products/${p._id}` === url.pathname);
        if (!data) throw new Error('Unexpected API path');
    }
    return Response.json({ success: true, data }, { status });
  };
  return { fetcher, store, products, get now() { return now; }, advance(ms: number) { now += ms; }, set mode(value: string) { mode = value; }, get creates() { return creates; }, get refreshes() { return refreshes; }, get lastOrder() { return lastOrder; } };
}
