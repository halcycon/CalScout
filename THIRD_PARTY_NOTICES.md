# Third-party notices

CalScout's implementation is original source licensed MPL-2.0. The included
LICENSE contains the Mozilla Public License 2.0 text. Native Thunderbird modules
are imported at runtime, not bundled or modified.

Research references (no implementation files copied):

- Mozilla Thunderbird / comm source: MPL-2.0, Mozilla contributors.
- Thunderbird `webext-experiments` calendar APIs: MPL-2.0 file notices.
- John Bieling's TbSync: MPL-2.0.
- DAV-4-TbSync v4.7: MPL-2.0 (verified repository LICENSE and source headers).
- DAVx5: GPL-3.0; architectural reference only. No GPL implementation incorporated.

Radicale 3.9.0 (GPL-3.0) is an optional separate integration-test server installed
in a test environment, not shipped in the extension. It does not change the
license of CalScout's independently written source.

`@xmldom/xmldom` 0.9.12 (MIT) is used only by Node tests and is not bundled in the
XPI. Its package license remains in the development dependency. Stalwart 1.0.3
(AGPL-3.0-only OR LicenseRef-SEL) is a separate optional fixture server, not bundled
or linked into CalScout. No Stalwart code is copied into the extension.
