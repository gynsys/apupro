import re
import os

path = '/var/www/arko360_platform/docker-compose.yml'
backup_path = '/var/www/arko360_platform/docker-compose.yml.bak'

with open(path, 'r') as f:
    content = f.read()

if not os.path.exists(backup_path):
    with open(backup_path, 'w') as f:
        f.write(content)

# We want to replace:
#    build:
#      context: ./admin-frontend
#      dockerfile: Dockerfile
# with:
#    image: nginx:alpine

# Regex to match build block
# Note: we need to match exactly the 3 lines of the build block
pattern = r"[ \t]+build:[ \t]*\n[ \t]+context: \./[a-zA-Z0-9_-]+[ \t]*\n[ \t]+dockerfile: Dockerfile"
new_content = re.sub(pattern, "    image: nginx:alpine", content)

with open(path, 'w') as f:
    f.write(new_content)

print("Docker compose patched successfully!")
