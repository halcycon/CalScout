# SPDX-License-Identifier: MPL-2.0
"""Disposable Stalwart 1.0.3 fixture. Run only inside an isolated network namespace.
All credentials and paths here belong exclusively to generated test accounts.
"""

import base64
import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from thunderbird import free_port

NS = {"d": "DAV:", "c": "urn:ietf:params:xml:ns:caldav"}
PROPS = b"""<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><c:calendar-home-set/><d:resourcetype/><d:displayname/><d:current-user-privilege-set/><d:group-membership/></d:prop></d:propfind>"""


class Stalwart:
    def __init__(self, directory, assisted):
        interfaces = json.loads(subprocess.check_output(["ip", "-j", "link", "show"], text=True))
        if any(interface["ifname"] != "lo" for interface in interfaces):
            raise RuntimeError(
                "Stalwart fixture requires an isolated network namespace containing only loopback"
            )
        self.directory = Path(directory)
        self.directory.mkdir()
        self.config = self.directory / "config.json"
        self.config.write_text(
            json.dumps({"@type": "RocksDb", "path": str(self.directory / "data")})
        )
        self.binary = os.environ["STALWART_BIN"]
        version = subprocess.check_output([self.binary, "--version"], text=True).strip()
        assert "1.0.3" in version, version
        self.log = open(self.directory / "server.log", "w+")
        self.recovery_port, self.port = free_port(), free_port()
        self.process = None
        try:
            self.base = f"http://127.0.0.1:{self.recovery_port}"
            self.start_process(
                {
                    **os.environ,
                    "STALWART_RECOVERY_MODE": "1",
                    "STALWART_RECOVERY_ADMIN": "admin:fixture-admin",
                    "STALWART_RECOVERY_MODE_PORT": str(self.recovery_port),
                },
                self.recovery_port,
            )
            self.configure(assisted)
            self.stop_process()
            self.base = f"http://127.0.0.1:{self.port}"
            env = {**os.environ, "STALWART_PUBLIC_URL": self.base}
            for key in [
                "STALWART_RECOVERY_MODE",
                "STALWART_RECOVERY_ADMIN",
                "STALWART_RECOVERY_MODE_PORT",
            ]:
                env.pop(key, None)
            self.start_process(env, self.port)
        except BaseException:
            self.close()
            raise

    def start_process(self, env, port):
        self.process = subprocess.Popen(
            [self.binary, "--config", str(self.config)],
            env=env,
            stdout=self.log,
            stderr=self.log,
        )
        self.wait(port)

    def stop_process(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.process = None

    def configure(self, assisted):
        domain = self.create(
            "Domain", {"name": "example.test", "dkimManagement": {"@type": "Manual"}}
        )
        self.create(
            "NetworkListener",
            {
                "name": "fixture",
                "bind": {f"127.0.0.1:{self.port}": True},
                "protocol": "http",
                "useTls": False,
            },
        )
        self.configure_accounts(domain)
        self.jmap(
            "x:SystemSettings/set",
            {
                "update": {
                    "singleton": {
                        "defaultHostname": "mail.example.test",
                        "defaultDomainId": domain,
                    }
                }
            },
        )
        self.jmap("x:WebDav/set", {"update": {"singleton": {"enableAssistedDiscovery": assisted}}})
        self.create("Tracer", {"@type": "Stdout", "level": "error", "enable": True})

    def configure_accounts(self, domain):
        self.team_id = self.create(
            "Account", {"@type": "Group", "name": "team", "domainId": domain}
        )
        credentials = {"0": {"@type": "Password", "secret": "fixture-password"}}
        self.alice_id = self.create(
            "Account",
            {
                "@type": "User",
                "name": "alice",
                "domainId": domain,
                "memberGroupIds": {self.team_id: True},
                "credentials": credentials,
            },
        )
        self.bob_id = self.create(
            "Account",
            {
                "@type": "User",
                "name": "bob",
                "domainId": domain,
                "credentials": credentials,
            },
        )
        self.create(
            "Account",
            {
                "@type": "User",
                "name": "admin",
                "domainId": domain,
                "roles": {"@type": "Admin"},
                "credentials": {"0": {"@type": "Password", "secret": "fixture-admin"}},
            },
        )

    def wait(self, port):
        deadline = time.monotonic() + 60
        while True:
            try:
                with socket.create_connection(("127.0.0.1", port), 0.5):
                    return
            except OSError:
                if self.process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Stalwart did not start")
                time.sleep(0.1)

    def request(
        self,
        path,
        method="PROPFIND",
        body=PROPS,
        user="alice",
        depth="0",
        content_type="application/xml",
    ):
        password = "fixture-admin" if user == "admin" else "fixture-password"
        username = (
            "admin" if self.base.endswith(f":{self.recovery_port}") else user + "@example.test"
        )
        headers = {
            "Authorization": "Basic "
            + base64.b64encode(f"{username}:{password}".encode()).decode(),
            "Content-Type": content_type,
            "Depth": depth,
        }
        request = urllib.request.Request(
            self.base + path, data=body, method=method, headers=headers
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as response:
            return response.code, response.read(), response.headers

    def jmap(self, method, args):
        body = {
            "using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
            "methodCalls": [[method, args, "fixture"]],
        }
        status, data, _ = self.request(
            "/jmap/",
            "POST",
            json.dumps(body).encode(),
            user="admin",
            content_type="application/json",
        )
        assert status == 200, (status, data)
        response = json.loads(data)["methodResponses"][0]
        assert response[0] == method, response
        result = response[1]
        assert not any(key in result for key in ["notCreated", "notUpdated", "notDestroyed"]), (
            result
        )
        return result

    def create(self, object_name, value):
        return self.jmap(f"x:{object_name}/set", {"create": {"fixture": value}})["created"][
            "fixture"
        ]["id"]

    def home(self, user):
        status, xml, _ = self.request("/dav/cal/", user=user)
        assert status == 207, (status, xml)
        return ET.fromstring(xml).find(".//c:calendar-home-set/d:href", NS).text

    def calendar(self, home, name, user="alice"):
        path = home + urllib.parse.quote(name) + "/"
        xml = f'<c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>{name}</d:displayname></d:prop></d:set></c:mkcalendar>'.encode()
        status, response, _ = self.request(path, "MKCALENDAR", xml, user=user)
        assert status == 201, (status, response)
        return path

    def share(self, path, target="team", revoke=False):
        ace = (
            ""
            if revoke
            else f"<d:ace><d:principal><d:href>/dav/pal/{target}%40example.test/</d:href></d:principal><d:grant><d:privilege><d:read/></d:privilege></d:grant></d:ace>"
        )
        xml = f'<d:acl xmlns:d="DAV:">{ace}</d:acl>'.encode()
        status, response, _ = self.request(path, "ACL", xml, user="bob")
        assert status in [200, 204], (status, response)

    def close(self):
        self.stop_process()
        self.log.close()
