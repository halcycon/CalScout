# ATN listing fields — CalScout 0.2.1

These are submission materials, not a claim that ATN has approved or listed the
extension. The extension ID remains `calscout@halcycon`.

## Name

CalScout

## Summary

Discover newly shared CalDAV calendars and add them to Thunderbird automatically.

## Description

CalScout finds CalDAV calendars available to your account, including calendars
shared directly or through a group. It checks again after initial account setup,
so newly shared calendars can appear without repeating Thunderbird's calendar
setup wizard.

Choose calendars yourself or enable automatic subscription after the initial
review. CalScout remembers ignored calendars and manual unsubscriptions. Existing
native CalDAV subscriptions supply account settings automatically. For another
account, it can suggest servers using your email domain's CalDAV service records;
an explicit server address is also supported.

Thunderbird's native CalDAV provider handles events, editing, reminders and
synchronization. CalScout manages discovery and native subscriptions. Existing
subscriptions continue working if CalScout is disabled. A missing calendar does
not cause automatic deletion of the subscription or its local data.

CalScout keeps account settings, calendar metadata, preferences and discovery logs
locally. It contacts configured calendar servers and can use DNS for server lookup.
It does not send analytics or calendar metadata to its developer. Passwords remain
in Thunderbird's native authentication system. Read the privacy policy for details.

The extension uses a privileged Experiment API and requests full Thunderbird
access to manage native subscriptions and authenticated discovery. Background
scans do not display authentication prompts; use the account's sign-in action
when authentication needs attention.

Tested on Linux x86_64 with Thunderbird 159.0 and 153.6.0 ESR, against Stalwart 1.0.3
and Radicale 3.9.0. Windows/macOS and OAuth-provider-specific coverage remain
limited. Discovery depends on calendars being advertised to your authenticated
account; CalScout cannot reveal resources hidden by the server.

CalScout is free and open source under MPL-2.0. No functionality requires payment.

## Metadata

- Author: Adam Camp / CuckooAdam
- License: Mozilla Public License 2.0 (MPL-2.0)
- Homepage/source: https://github.com/halcycon/CalScout
- Support: https://github.com/halcycon/CalScout/issues
- Author website: https://links.thecuckoocamp.co.uk/@cuckooadam
- Optional support: https://ko-fi.com/thecuckoocamp (use a contribution/profile field if offered)
- Compatibility: manifest minimum 153.0; maximum 159.*; specifically tested releases
  are recorded in COMPATIBILITY.md. Do not select additional platforms as tested.
- Category: select the site's calendar-related category.
- Privacy policy: paste the complete contents of `src/ui/privacy.txt` into ATN's
  privacy field. A policy URL by itself is insufficient.
- Icon source: `src/ui/icon.svg`; the submission bundle also contains a 128px PNG.

## Screenshots

Generated from the actual extension UI running in Thunderbird 159, using only
isolated fixture accounts. The images show local demonstration data, not a real
person's calendar metadata. No passwords or authentication headers are visible.

- `screenshots/calendars.png`: native subscriptions discovered for Alice, including
  Team and Bob's calendars shared through Team; read-only permissions are shown.
- `screenshots/preferences.png`: discovery interval and subscription preferences.
