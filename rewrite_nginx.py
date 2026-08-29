config = """server {
    server_name costbase.net www.costbase.net;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_pass http://127.0.0.1:8010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/costbase.net/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/costbase.net/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.costbase.net) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = costbase.net) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name costbase.net www.costbase.net;
    return 404; # managed by Certbot
}
"""

with open('/etc/nginx/sites-available/costbase.net', 'w') as f:
    f.write(config)
