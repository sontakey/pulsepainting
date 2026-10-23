// Operators authenticate through the private database and Blob environment.
// No administrator credential or administration route is exposed to browsers.
import { getCommunityService } from '../server/community.js';

const [command, id] = process.argv.slice(2);
if (!['reports', 'hide', 'cleanup'].includes(command)) {
  console.error('Usage: node --env-file=<private-env> tools/community-admin.mjs reports | hide <painting-id> | cleanup');
  process.exitCode = 1;
} else {
  try {
    const service = getCommunityService();
    let result;
    if (command === 'cleanup') {
      let cursor = null;
      result = { cleaned: 0, expiredRateBuckets: 0 };
      do {
        const page = await service.cleanup({ cursor });
        result.cleaned += page.cleaned; result.expiredRateBuckets += page.expiredRateBuckets; cursor = page.nextCursor;
      } while (cursor);
    } else result = command === 'reports' ? await service.reports() : await service.hide(id);
    console.log(JSON.stringify({ namespace: service.namespace, result }, null, 2));
  } catch (error) {
    console.error(error?.code || 'community_admin_failed'); process.exitCode = 1;
  }
}
