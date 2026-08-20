import urllib.request
import urllib.error

req = urllib.request.Request('http://localhost:8001/api/v1/arko/admin/config', method='PUT')
try:
    print(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read())
