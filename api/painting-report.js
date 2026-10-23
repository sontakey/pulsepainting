import { CommunityError, getCommunityService } from '../server/community.js';
import { checkOrigin, errorResponse, json, readJSON, sourceFor } from '../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new CommunityError(405, 'method_not_allowed', 'Method not allowed.'); }
    checkOrigin(req);
    return json(res, 200, await getCommunityService().report(await readJSON(req), sourceFor(req)));
  } catch (error) { errorResponse(res, error); }
}
