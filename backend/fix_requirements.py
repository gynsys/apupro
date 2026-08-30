with open('requirements.txt', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('openpyxl==3.1.2google-auth', 'openpyxl==3.1.2\ngoogle-auth')
content = content.replace('c\u0000l\u0000o\u0000u\u0000d\u0000s\u0000c\u0000r\u0000a\u0000p\u0000e\u0000r\u0000=\u0000=\u00001\u0000.\u00002\u0000.\u00007\u00001\u0000\u0000', 'cloudscraper==1.2.71')

with open('requirements.txt', 'w', encoding='utf-8') as f:
    f.write(content)

print("Requirements.txt fixed")
