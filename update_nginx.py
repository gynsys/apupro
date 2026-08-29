import re

with open('/etc/nginx/sites-available/costbase.net', 'r') as f:
    config = f.read()

ws_config = """        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';"""

if 'proxy_http_version 1.1;' not in config:
    config = config.replace('location /api/ {', 'location /api/ {\\n' + ws_config)
    with open('/etc/nginx/sites-available/costbase.net', 'w') as f:
        f.write(config)
    print("Updated Nginx configuration.")
else:
    print("Nginx configuration already has WebSocket support.")
