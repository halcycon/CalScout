"""Real Stalwart group-sharing acceptance test, both assisted-discovery modes.

Set STALWART_BIN (1.0.3) and THUNDERBIRD_BIN (156). On Linux this script re-execs
inside an isolated user/network namespace before starting the fixture server.
Use --record to refresh the sanitized, fixture-only DAV XML recordings.
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from stalwart_fixture import NS, Stalwart
from thunderbird import API, CAL, ROOT, Marionette, free_port


def stop(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def mode(assisted, directory, record):
    server = Stalwart(directory / "server", assisted)
    thunderbird = None
    log = open(directory / "thunderbird.log", "w+")
    try:
        alice_home, bob_home = server.home("alice"), server.home("bob")
        server.calendar(alice_home, "Alice")
        server.calendar("/dav/cal/team%40example.test/", "Team")
        shared = server.calendar(bob_home, "BobShared", "bob")
        direct = server.calendar(bob_home, "BobDirect", "bob")
        server.share(shared)
        server.share(direct, "alice")
        status, shared_xml, _ = server.request(shared)
        assert status == 207, (status, shared_xml)
        shared_row = ET.fromstring(shared_xml)
        assert shared_row.find(".//c:calendar", NS) is not None
        assert shared_row.find(".//d:current-user-privilege-set/d:privilege/d:read", NS) is not None
        print(
            f"PASS assisted={assisted}: Alice’s authenticated PROPFIND confirms Bob → Team effective read access",
            flush=True,
        )
        status, principal_xml, _ = server.request("/dav/pal/alice%40example.test/")
        assert status == 207
        homes = [
            e.text
            for e in ET.fromstring(principal_xml).findall(".//c:calendar-home-set/d:href", NS)
        ]
        if not assisted:
            assert len(homes) >= 3, homes
        home_responses = []
        for home in homes:
            code, xml, _ = server.request(home, depth="1")
            assert code == 207, (home, code, xml)
            home_responses.append((home, xml.decode()))
        if record:
            fixtures = ROOT / "tests/fixtures"
            fixtures.mkdir(exist_ok=True)
            prefix = "stalwart-1.0.3-" + ("assisted" if assisted else "multiple-homes")
            (fixtures / f"{prefix}-principal.xml").write_bytes(principal_xml)
            (fixtures / f"{prefix}-group-share.xml").write_bytes(shared_xml)
            (fixtures / f"{prefix}-homes.json").write_text(
                json.dumps(home_responses, indent=2) + "\n"
            )
        try:
            urllib.request.urlopen(
                urllib.request.Request(server.base + alice_home, data=b"", method="PROPFIND"),
                timeout=5,
            )
            raise AssertionError("Fixture unexpectedly allows unauthenticated calendar access")
        except urllib.error.HTTPError as error:
            assert error.code == 401
            realm = re.search(r'realm="([^"]+)"', error.headers["WWW-Authenticate"]).group(1)
        profile = directory / "profile"
        profile.mkdir()
        driver_port = free_port()
        (profile / "user.js").write_text(f"""user_pref("marionette.port",{driver_port});
user_pref("mail.provider.suppress_dialog_on_startup",true);
user_pref("mail.shell.checkDefaultClient",false);
user_pref("mailnews.start_page.enabled",false);
""")
        thunderbird = subprocess.Popen(
            [
                os.environ["THUNDERBIRD_BIN"],
                "--headless",
                "--no-remote",
                "--profile",
                str(profile),
                "--marionette",
                "--remote-allow-system-access",
            ],
            env={**os.environ, "MOZ_HEADLESS": "1"},
            stdout=log,
            stderr=log,
        )
        driver = Marionette(driver_port, thunderbird)
        assert driver.capabilities["browserVersion"].startswith("156.")
        driver.execute(
            """
const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);
await AddonManager.installTemporaryAddon(file);
const login=Cc['@mozilla.org/login-manager/loginInfo;1'].createInstance(Ci.nsILoginInfo);
login.init(arguments[1],null,arguments[2],'alice@example.test','fixture-password','','');
await Services.logins.addLoginAsync(login);
return true;
""",
            [str(ROOT / "dist/calscout-0.1.0.xpi"), server.base, realm],
        )
        result = driver.execute(
            API
            + "return api.scan({url:arguments[0]+'/.well-known/caldav',username:'alice@example.test',allowLocalhost:true},false);",
            [server.base],
        )
        assert not result.get("error"), result
        names = {r["name"] for r in result["resources"]}
        assert {"Alice", "Team", "BobShared", "BobDirect"} <= names, result
        assert result["complete"], result
        assert next(r for r in result["resources"] if r["name"] == "BobShared")["readOnly"] is True
        print(
            f"PASS assisted={assisted}: CalScout native authenticated discovery enumerates personal, group, direct and group-shared collections",
            flush=True,
        )
        driver.execute("""
const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');
const extension=ExtensionParent.GlobalManager.getExtension('calscout@halcycon');
Services.wm.getMostRecentWindow('mail:3pane').document.getElementById('tabmail').openTab('contentTab',{url:extension.baseURI.resolve('ui/manage.html?acceptance=1')});
await new Promise(resolve=>setTimeout(resolve,400));return true;
""")
        server.jmap("x:Account/set", {"update": {server.alice_id: {"memberGroupIds": {}}}})
        response = driver.ui(
            "return window.wrappedJSObject.browser.runtime.sendMessage({action:'addAccount',account:{url:arguments[0]+'/.well-known/caldav',username:'alice@example.test',allowLocalhost:true}});",
            [server.base],
        )
        assert response["ok"], response
        response = driver.ui(
            "return window.wrappedJSObject.browser.runtime.sendMessage({action:'scan'});"
        )
        assert response["ok"], response
        assert not any(r["subscriptionId"] for r in response["state"]["resources"]), response
        assert not any(
            r["name"] in ["Team", "BobShared"] for r in response["state"]["resources"]
        ), response
        driver.ui(
            "return window.wrappedJSObject.browser.runtime.sendMessage({action:'finishSetup'});"
        )
        driver.ui(
            "return window.wrappedJSObject.browser.runtime.sendMessage({action:'settings',settings:{policy:'auto',interval:15}});"
        )
        server.jmap(
            "x:Account/set",
            {"update": {server.alice_id: {"memberGroupIds": {server.team_id: True}}}},
        )
        later = server.calendar(bob_home, "BobLater", "bob")
        server.share(later)
        driver.ui(
            "window.wrappedJSObject.browser.alarms.create('calscout-tick',{delayInMinutes:0.01});return true;"
        )
        deadline = time.monotonic() + 25
        while True:
            response = driver.ui(
                "return window.wrappedJSObject.browser.runtime.sendMessage({action:'state'});"
            )
            record = next(
                (r for r in response["state"]["resources"] if r["name"] == "BobLater"),
                None,
            )
            if record and record["subscriptionId"]:
                break
            if time.monotonic() > deadline:
                raise AssertionError(response)
            time.sleep(0.2)
        assert record["readOnly"] is True
        assert all(
            any(r["name"] == name and r["subscriptionId"] for r in response["state"]["resources"])
            for name in ["Team", "BobShared"]
        ), response
        print(
            f"PASS assisted={assisted}: joining Team makes its existing and inherited shared calendars available on the next alarm",
            flush=True,
        )
        event = b"BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CalScout//Test//EN\r\nBEGIN:VEVENT\r\nUID:group-share-proof\r\nDTSTAMP:20260101T000000Z\r\nDTSTART:20261108T100000Z\r\nDTEND:20261108T110000Z\r\nSUMMARY:Bob via Team\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
        status, xml, _ = server.request(
            later + "proof.ics", "PUT", event, user="bob", content_type="text/calendar"
        )
        assert status in [201, 204], (status, xml)
        assert driver.execute(
            CAL
            + """
const calendar=cal.manager.getCalendarById(arguments[0]);
if (!calendar.readOnly) throw new Error('Expected a native read-only subscription');
calendar.refresh();
for(let i=0;i<100;i++){
 const items=await calendar.getItemsAsArray(Ci.calICalendar.ITEM_FILTER_TYPE_ALL,0,null,null);
 if(items.some(item=>item.id==='group-share-proof'))return true;
 await new Promise(resolve=>setTimeout(resolve,200));
}
throw new Error('Native provider failed to synchronize Bob’s calendar through Team ACL');
""",
            [record["subscriptionId"]],
        )
        print(
            f"PASS assisted={assisted}: later Bob → Team share is automatically subscribed and native Thunderbird sync reads its event",
            flush=True,
        )
        server.share(later, revoke=True)
        for _ in range(2):
            response = driver.ui(
                "return window.wrappedJSObject.browser.runtime.sendMessage({action:'scan'});"
            )
            assert response["ok"], response
        record = next(r for r in response["state"]["resources"] if r["name"] == "BobLater")
        assert record["availability"] == "unavailable", response
        assert driver.execute(
            CAL + "return !!cal.manager.getCalendarById(arguments[0]);",
            [record["subscriptionId"]],
        )
        print(
            f"PASS assisted={assisted}: revoked access is marked unavailable and native subscription is preserved",
            flush=True,
        )
        driver.call("WebDriver:DeleteSession", {})
        driver.sock.close()
    except BaseException:
        log.flush()
        log.seek(0)
        print(log.read()[-6000:], file=sys.stderr)
        raise
    finally:
        stop(thunderbird)
        server.close()
        log.close()


def main():
    if "--isolated" not in sys.argv:
        command = [
            "unshare",
            "--user",
            "--map-root-user",
            "--net",
            sys.executable,
            str(Path(__file__).resolve()),
            "--isolated",
        ]
        if "--record" in sys.argv:
            command.append("--record")
        sys.exit(subprocess.call(command))
    subprocess.run(["ip", "link", "set", "lo", "up"], check=True)
    if not os.environ.get("STALWART_BIN") or not os.environ.get("THUNDERBIRD_BIN"):
        sys.exit("Set STALWART_BIN (1.0.3) and THUNDERBIRD_BIN (156).")
    with tempfile.TemporaryDirectory(prefix="calscout-stalwart-") as tmp:
        for assisted in (True, False):
            directory = Path(tmp) / str(assisted)
            directory.mkdir()
            mode(assisted, directory, "--record" in sys.argv)


if __name__ == "__main__":
    main()
