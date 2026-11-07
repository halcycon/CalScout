"""Real Thunderbird + authenticated Radicale smoke test, in temporary profiles.

Requires THUNDERBIRD_BIN and `python -m pip install radicale` in a test venv.
Uses the Marionette protocol directly; no test code ships in the extension.
"""
import base64
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class Marionette:
    def __init__(self, port, process):
        deadline = time.monotonic() + 30
        while True:
            try:
                self.sock = socket.create_connection(('127.0.0.1', port), 1)
                break
            except OSError:
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise RuntimeError('Thunderbird failed to start; see test log')
                time.sleep(.2)
        self.sock.settimeout(70)
        self.sequence = 0
        self.receive()
        self.capabilities = self.call('WebDriver:NewSession', {'capabilities': {}})['capabilities']
        self.call('Marionette:SetContext', {'value': 'chrome'})

    def receive(self):
        length = b''
        while (char := self.sock.recv(1)) != b':':
            if not char:
                raise RuntimeError('Marionette disconnected')
            length += char
        data = b''
        while len(data) < int(length):
            chunk = self.sock.recv(int(length) - len(data))
            if not chunk:
                raise RuntimeError('Marionette disconnected')
            data += chunk
        return json.loads(data)

    def call(self, name, args):
        self.sequence += 1
        packet = json.dumps([0, self.sequence, name, args]).encode()
        self.sock.sendall(str(len(packet)).encode() + b':' + packet)
        result = self.receive()
        if result[2]:
            raise RuntimeError(result[2])
        return result[3]

    def execute(self, script, args=()):
        wrapper = '''const done=arguments[arguments.length-1];
        (async()=>{ %s })().then(value=>done({ok:true,value}),
          error=>done({ok:false,error:String(error),stack:error.stack}));''' % script
        response = self.call('WebDriver:ExecuteAsyncScript', {
            'script': wrapper, 'args': list(args), 'newSandbox': False,
            'sandbox': 'default', 'scriptTimeout': 60000,
        })['value']
        if not response['ok']:
            raise RuntimeError(response)
        return response.get('value')


API = '''
const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');
const extension=ExtensionParent.GlobalManager.getExtension('calscout@halcycon');
const api=(await extension.apiManager.asyncGetAPI('calendarBridge',extension,'addon_parent')).getAPI({extension}).calendarBridge;
'''
CAL = "const {cal}=ChromeUtils.importESModule('resource:///modules/calendar/calUtils.sys.mjs');"


def main():
    binary = os.environ.get('THUNDERBIRD_BIN') or shutil.which('thunderbird')
    if not binary:
        sys.exit('Set THUNDERBIRD_BIN to a Thunderbird 156 executable.')
    with tempfile.TemporaryDirectory(prefix='calscout-test-') as directory:
        tmp = Path(directory)
        profile = tmp / 'profile'
        profile.mkdir()
        dav_port, driver_port = free_port(), free_port()
        base = f'http://127.0.0.1:{dav_port}'
        (tmp / 'users').write_text('alice:fixture-password\nbob:another-fixture-password\n')
        config = tmp / 'radicale.conf'
        config.write_text(f'''[server]
hosts = 127.0.0.1:{dav_port}
[auth]
type = htpasswd
htpasswd_filename = {tmp / 'users'}
htpasswd_encryption = plain
[rights]
type = owner_only
[storage]
filesystem_folder = {tmp / 'collections'}
[logging]
level = warning
''')
        (profile / 'user.js').write_text(f'''user_pref("marionette.port", {driver_port});
user_pref("mail.provider.suppress_dialog_on_startup", true);
user_pref("mail.shell.checkDefaultClient", false);
user_pref("mailnews.start_page.enabled", false);
''')
        log = open(tmp / 'test.log', 'w+')
        server = subprocess.Popen([sys.executable, '-m', 'radicale', '--config', str(config)], stdout=log, stderr=log)
        thunderbird = None
        try:
            auth = 'Basic ' + base64.b64encode(b'alice:fixture-password').decode()

            def request(path, method, data=None):
                return urllib.request.urlopen(urllib.request.Request(base + path, data=data,
                    method=method, headers={'Authorization': auth, 'Content-Type': 'application/xml; charset=utf-8'}), timeout=5).read()

            deadline = time.monotonic() + 15
            while True:
                try:
                    request('/', 'OPTIONS')
                    break
                except OSError:
                    if server.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError('Radicale failed to start')
                    time.sleep(.1)
            request('/alice/personal/', 'MKCALENDAR', b'''<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>Personal</d:displayname></d:prop></d:set></c:mkcalendar>''')
            event = b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CalScout//Test//EN\r\nBEGIN:VEVENT\r\nUID:calscout-smoke\r\nDTSTAMP:20260101T000000Z\r\nDTSTART:20261108T100000Z\r\nDTEND:20261108T110000Z\r\nSUMMARY:Native sync proof\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
            request('/alice/personal/proof.ics', 'PUT', event)
            thunderbird = subprocess.Popen([binary, '--headless', '--no-remote', '--profile', str(profile),
                '--marionette', '--remote-allow-system-access'], env={**os.environ, 'MOZ_HEADLESS': '1'}, stdout=log, stderr=log)
            driver = Marionette(driver_port, thunderbird)
            print('Thunderbird:', driver.capabilities['browserVersion'])
            assert driver.capabilities['browserVersion'].startswith('156.'), 'Run this acceptance test against the target Thunderbird 156'
            driver.execute('''
const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile); file.initWithPath(arguments[0]);
await AddonManager.installTemporaryAddon(file);
// Fixture credentials are seeded by the test, never by CalScout.
const login=Cc['@mozilla.org/login-manager/loginInfo;1'].createInstance(Ci.nsILoginInfo);
login.init(arguments[1],null,'Radicale - Password Required','alice','fixture-password','','');
await Services.logins.addLoginAsync(login);
return true;
''', [str(ROOT / 'src'), base])
            calendar = driver.execute(API + '''return api.register({url:arguments[0]+'/alice/personal/',name:'Personal',username:'alice',allowLocalhost:true});''', [base])
            print('Native subscription:', calendar['type'], calendar['username'])
            assert calendar['type'] == 'caldav' and calendar['managed']
            duplicate = driver.execute(API + '''return api.register({url:arguments[0]+'/alice/%70ersonal',name:'Duplicate',username:'alice',allowLocalhost:true});''', [base])
            assert duplicate['id'] == calendar['id']
            print('PASS: URL normalization prevents duplicate subscription')
            result = driver.execute(CAL + '''
const calendar=cal.manager.getCalendarById(arguments[0]);
calendar.refresh();
for (let i=0;i<100;i++) {
  const items=await calendar.getItemsAsArray(Ci.calICalendar.ITEM_FILTER_TYPE_ALL,0,null,null);
  if (items.some(item=>item.id==='calscout-smoke')) return items.map(item=>({id:item.id,title:item.title}));
  await new Promise(resolve=>setTimeout(resolve,200));
}
throw new Error('Native CalDAV provider did not synchronize the fixture event');
''', [calendar['id']])
            assert any(item['title'] == 'Native sync proof' for item in result)
            print('PASS: Thunderbird native CalDAV synchronized an authenticated server event')
            driver.execute('''const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs'); await (await AddonManager.getAddonByID('calscout@halcycon')).disable(); return true;''')
            request('/alice/personal/proof.ics', 'PUT', event.replace(b'Native sync proof', b'Native sync after disable'))
            result = driver.execute(CAL + '''
const calendar=cal.manager.getCalendarById(arguments[0]);
calendar.refresh();
for (let i=0;i<100;i++) {
  const items=await calendar.getItemsAsArray(Ci.calICalendar.ITEM_FILTER_TYPE_ALL,0,null,null);
  if (items.some(item=>item.title==='Native sync after disable')) return true;
  await new Promise(resolve=>setTimeout(resolve,200));
}
throw new Error('Native calendar did not continue syncing after extension disable');
''', [calendar['id']])
            assert result
            print('PASS: native subscription continues synchronizing with CalScout disabled')
            driver.call('WebDriver:DeleteSession', {})
            driver.sock.close()
        except Exception:
            log.flush()
            log.seek(0)
            print(log.read()[-10000:], file=sys.stderr)
            raise
        finally:
            for process in (thunderbird, server):
                if process:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            log.close()


if __name__ == '__main__':
    main()
