import urllib.request

req = urllib.request.Request('http://localhost:8001/api/v1/cost360/databases/initialize', method='POST')
print(urllib.request.urlopen(req).read())
