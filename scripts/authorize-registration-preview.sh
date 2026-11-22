#!/usr/bin/env bash
set -euo pipefail
PROJECT=latinrw
DOMAIN=latin-lessons-i-to-lvii-with-appendix-t-git-26a32e-lake-s-latin.vercel.app
KEY=6LdA4iwuAAAAADeG0UwRp6Dm8OQU45g7llRvA--C
TOKEN=$(gcloud auth print-access-token)
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
AUTH_URL="https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config"
CAPTCHA_URL="https://recaptchaenterprise.googleapis.com/v1/projects/$PROJECT/keys/$KEY"
for name in auth captcha; do
 URL="$AUTH_URL"; [[ "$name" == captcha ]] && URL="$CAPTCHA_URL"
 curl --fail-with-body -sS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" "$URL" > "$DIR/$name.json"
done
python3 - "$DIR" "$DOMAIN" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);domain=sys.argv[2]
a=json.loads((p/'auth.json').read_text());r=json.loads((p/'captcha.json').read_text())
auth=sorted(set(a.get('authorizedDomains',[])+[domain]))
cap=sorted(set(r.get('webSettings',{}).get('allowedDomains',[])+[domain]))
(p/'auth-patch.json').write_text(json.dumps({'authorizedDomains':auth}))
(p/'captcha-patch.json').write_text(json.dumps({'webSettings':{'allowedDomains':cap}}))
PY
curl --fail-with-body -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" -H 'Content-Type: application/json' --data-binary "@$DIR/auth-patch.json" "$AUTH_URL?updateMask=authorizedDomains" > /dev/null
curl --fail-with-body -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" -H 'Content-Type: application/json' --data-binary "@$DIR/captcha-patch.json" "$CAPTCHA_URL?updateMask=webSettings.allowedDomains" > /dev/null
printf 'Preview hostname authorized. Existing domains preserved. Registration remains closed.\n'
printf 'Open https://%s/setup-check.html and sign in with your existing instructor Google account.\n' "$DOMAIN"
