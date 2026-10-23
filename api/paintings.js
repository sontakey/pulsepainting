import { allowKeys, CommunityError, getCommunityService } from '../server/community.js';
import { checkOrigin, errorResponse, json, query, readJSON, sourceFor } from '../server/http.js';

export default async function handler(req, res) {
  try {
    const params = query(req); allowKeys(params, ['id', 'cursor', 'limit']);
    const service = getCommunityService();
    if (req.method === 'GET') {
      if (params.id) return json(res, 200, { painting: await service.get(params.id) }, { cache: true });
      return json(res, 200, await service.list({ cursor: params.cursor ?? null, limit: params.limit === undefined ? 24 : Number(params.limit) }), { cache: true });
    }
    if (!['POST', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, DELETE'); throw new CommunityError(405, 'method_not_allowed', 'Method not allowed.'); }
    checkOrigin(req);
    const body = await readJSON(req);
    if (req.method === 'DELETE') return json(res, 200, await service.remove(params.id, body));
    if (Object.keys(params).length) throw new CommunityError(400, 'invalid_request', 'Unexpected query parameters.');
    const result = await service.publish(body, sourceFor(req));
    return json(res, result.created ? 201 : 200, result);
  } catch (error) { errorResponse(res, error); }
}
