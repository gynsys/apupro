import sys

file_path = r"c:\Users\pablo\Documents\apupro_platform\backend\app\api\v1\endpoints\arko.py"
with open(file_path, "rb") as f:
    content = f.read()

# Replace UTF-8 encoded characters that got doubly encoded
content = content.replace(b"est\xc3\x83\xc2\xa1", b"est\xc3\xa1")
content = content.replace(b"recibir\xc3\x83\xc2\xa1s", b"recibir\xc3\xa1s")
content = content.replace(b"recuperaci\xc3\x83\xc2\xb3n", b"recuperaci\xc3\xb3n")
content = content.replace(b"v\xc3\x83\xc2\xa1lido", b"v\xc3\xa1lido")
content = content.replace(b"Contrase\xc3\x83\xc2\xb1a", b"Contrase\xc3\xb1a")
content = content.replace(b"inv\xc3\x83\xc2\xa1lido", b"inv\xc3\xa1lido")
content = content.replace(b"Ocurri\xc3\x83\xc2\xb3", b"Ocurri\xc3\xb3")

# Try another level if it is just single misencoded
content = content.replace(b"est\xc3\xa1", b"est\xc3\xa1")  # well this is correct
content = content.replace(b"est\xc3\x83\xc2\xa1", b"est\xc3\xa1")

# Actually, the string "Si tu correo" is probably safe to just re-write entirely:
content = content.replace(b"Si tu correo est\xc3\x83\xc2\xa1 registrado, recibir\xc3\x83\xc2\xa1s un enlace de recuperaci\xc3\x83\xc2\xb3n.", "Si tu correo está registrado, recibirás un enlace de recuperación.".encode("utf-8"))
content = content.replace(b"Si tu correo est\xc3\xa1 registrado, recibir\xc3\xa1s un enlace de recuperaci\xc3\xb3n.", "Si tu correo está registrado, recibirás un enlace de recuperación.".encode("utf-8"))
content = content.replace(b"Si tu correo est\xc3\x83\xc2\xa1 registrado, recibir\xc3\x83\xc2\xa1s un nuevo enlace.", "Si tu correo está registrado, recibirás un nuevo enlace.".encode("utf-8"))
content = content.replace(b"Si tu correo est\xc3\xa1 registrado, recibir\xc3\xa1s un nuevo enlace.", "Si tu correo está registrado, recibirás un nuevo enlace.".encode("utf-8"))
content = content.replace(b"El correo ya est\xc3\xa1 verificado.", "El correo ya está verificado.".encode("utf-8"))

with open(file_path, "wb") as f:
    f.write(content)
