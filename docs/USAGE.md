# Using CalScout

## Install

Download the `.xpi` asset from [GitHub Releases](https://github.com/halcycon/CalScout/releases),
or build using `npm run build` (Python 3 required). In Thunderbird **153.6 ESR–159**, open
Add-ons and Themes, choose the gear menu → Install Add-on From File, and select
`dist/calscout-0.2.0.xpi`. Thunderbird warns about full application access because
CalScout uses a calendar Experiment. Normal unsigned installation was tested on
Thunderbird 153.6 ESR and 159; no signing preference changes were necessary.

For temporary development installation, use Debug Add-ons → Load Temporary
Add-on → `src/manifest.json`. This disappears at Thunderbird restart.

## First setup

Open the **CalDAV Discovery** toolbar action → **Manage calendars**. Existing
HTTPS native CalDAV subscriptions supply server/account settings automatically.
Select **Discover / sign in** on an account if Thunderbird needs to authenticate.

For a new account, choose **Find configured mail accounts**, pick your email,
then **Find calendar server**. CalScout checks secure CalDAV DNS SRV/TXT records
and offers the domain's standard well-known endpoint. Pick a candidate and choose
**Connect and discover**. An administrator-provided endpoint can be entered under
Advanced server settings if the provider doesn't publish usable discovery data.
Connecting the same origin/username again updates its endpoint safely.

Thunderbird may prompt for a calendar password or app password. A mail account
alone does not establish permission to use its credentials for CalDAV. CalScout
never copies a mail password. Use **Discover / sign in** when authentication
expires; ordinary startup/periodic scans never prompt.

## Choose calendars and automation

Review available calendars and click Subscribe or Ignore. Ignored resources can
be restored individually. Finish the initial review when ready. In preferences,
choose Ask before subscribing (the default) or Subscribe automatically. Automatic
subscription requires both the policy and completion of the first-run review.

Automatic discovery defaults to every 30 minutes; choose 15, 60 or 120 minutes,
or manual only. Individual accounts can be paused. Discover Now rescans enabled
accounts without clearing configuration. An account-specific Discover / sign in
also allows a native authentication prompt.

To unsubscribe, use Thunderbird's normal calendar interface. CalScout remembers
that decision and does not recreate the subscription. Restore the ignored record
to make it eligible again, or click Subscribe to choose it explicitly.

## Access and errors

One missing complete listing is marked unconfirmed; two mark inaccessible.
Offline, malformed and authentication-failed scans do not imply revocation.
Subscriptions and local data are retained. Optional disabling after three absent
complete scans affects only CalScout-managed subscriptions and preserves data.
After access returns, re-enable a disabled calendar in Thunderbird.

Authentication errors suspend unattended retries. Network/server errors back off.
Diagnostics are local and omit credentials and raw HTTP bodies. Debug logging
shows more structured details. CalScout contacts only configured calendar servers
and the DNS resolver, with no analytics service.

Disabling or uninstalling CalScout leaves native subscriptions usable. Thunderbird
continues to own event sync, reminders, editing, offline caches and authentication.
