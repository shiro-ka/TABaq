import datetime
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile

REPO = 'shiro-ka/TABaq'
TAG = 'dev'
ADDON_ID = 'tabaq@lab49'
ROOT = os.path.dirname(os.path.abspath(__file__))
API = 'https://api.github.com/repos/' + REPO
DOWNLOAD = 'https://github.com/' + REPO + '/releases/download/' + TAG + '/'
FILES = ['manifest.json', 'background.js', 'newtab.html', 'newtab.css', 'newtab.js', 'js', 'icons']


def api(method, url, data=None, content_type='application/json'):
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
        'Accept': 'application/vnd.github+json',
        'Content-Type': content_type,
    })
    with urllib.request.urlopen(req) as res:
        body = res.read()
        return json.loads(body) if body else None


def stamp(base):
    now = datetime.datetime.now()
    return '%s.%s.%d' % (base, now.strftime('%Y%m%d'), int(now.strftime('%H%M')))


def paths():
    for name in FILES:
        full = os.path.join(ROOT, name)
        if os.path.isfile(full):
            yield name
            continue
        for d, _, fs in os.walk(full):
            for f in sorted(fs):
                if f != '.DS_Store':
                    yield os.path.relpath(os.path.join(d, f), ROOT)


def build(version):
    out = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'TABaq-%s.xpi' % version)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in paths():
            with open(os.path.join(ROOT, rel), 'rb') as f:
                data = f.read()
            if rel == 'manifest.json':
                manifest = json.loads(data)
                manifest['version'] = version
                data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
            z.writestr(rel, data)
    return out


def release():
    try:
        return api('GET', API + '/releases/tags/' + TAG)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    return api('POST', API + '/releases', json.dumps({
        'tag_name': TAG, 'target_commitish': 'main', 'name': TAG, 'prerelease': True, 'body': ''
    }).encode())


def upload(rel, name, data, content_type):
    url = rel['upload_url'].split('{')[0] + '?name=' + name
    api('POST', url, data, content_type)


def main():
    with open(os.path.join(ROOT, 'manifest.json')) as f:
        version = stamp(json.load(f)['version'])
    xpi = build(version)
    name = os.path.basename(xpi)
    updates = {'addons': {ADDON_ID: {'updates': [{'version': version, 'update_link': DOWNLOAD + name}]}}}

    rel = release()
    for asset in rel.get('assets', []):
        api('DELETE', API + '/releases/assets/%d' % asset['id'])
    with open(xpi, 'rb') as f:
        upload(rel, name, f.read(), 'application/x-xpinstall')
    upload(rel, 'updates.json', json.dumps(updates, indent=2).encode(), 'application/json')
    print(version, DOWNLOAD + name)


if __name__ == '__main__':
    sys.exit(main())
