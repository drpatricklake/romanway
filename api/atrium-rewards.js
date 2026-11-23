// Settles Atrium rewards on the server. Students cannot write XP; this route can, and only after reading the stored
// documents itself. The browser names which items to look at; it supplies no facts and no calculation.
import {adminServices, verifiedUser} from '../server/admin.js';
import {createFirestoreStore} from '../server/atrium-firestore.js';
import {createAtriumRewards} from '../server/atrium-engine.js';

const OWNER_UID = 'ZU5goPmM28X40rVridJLtZ9JcBu2';

export function createRewardsHandler({getServices = adminServices, makeStore = createFirestoreStore, verify = verifiedUser, ownerUid = OWNER_UID} = {}) {
  let rewards;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed.'});
    if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`) return res.status(403).json({error: 'Use the app website.'});
    const body = req.body || {};
    if (Buffer.byteLength(JSON.stringify(body)) > 4096) return res.status(413).json({error: 'Request too large.'});
    try {
      const {db, auth} = await getServices();
      rewards ||= createAtriumRewards({store: makeStore(db), ownerUid});
      // The caller is whoever the verified token says. A uid, name, or total in the body is never read.
      const user = await verify(db, auth, String(req.headers.authorization || '').replace(/^Bearer /, ''));
      const result = await rewards.settle({
        classId: String(body.classId || 'pilot'), uid: user.uid,
        questions: body.questions || [], clients: body.clients || [], followups: body.followups || [],
      });
      return res.status(200).json(result);
    } catch (e) {
      const status = e.status || (['auth/id-token-expired', 'auth/argument-error', 'auth/id-token-revoked'].includes(e.code) ? 401 : 500);
      return res.status(status).json({error: status < 500 ? e.message : 'Rewards could not be updated. Try again in a moment.'});
    }
  };
}

export default createRewardsHandler();
