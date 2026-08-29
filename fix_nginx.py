import re

with open('/etc/nginx/sites-available/costbase.net', 'r') as f:
    config = f.read()

config = config.replace('location /api/ {\\n', 'location /api/ {\\n')

with open('/etc/nginx/sites-available/costbase.net', 'w') as f:
    f.write(config)
