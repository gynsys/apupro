import sys

file_path = r"c:\Users\pablo\Documents\apupro_platform\frontend\src\components\landing\RegisterModal.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import_str = "import { useGoogleLogin } from \"@react-oauth/google\";"
if "registerArkoAdmin" not in content:
    content = content.replace("from '@react-oauth/google';", "from '@react-oauth/google';\nimport { registerArkoAdmin } from '../../services/api';")

old_submit = """    try {
      // Para el flujo actual simplemente redirigimos al login tras una pausa
      setTimeout(() => {
        setIsLoading(false);
        onSwitchToLogin();
      }, 1500);
    } catch (err) {"""

new_submit = """    try {
      await registerArkoAdmin(email, password, username);
      setIsLoading(false);
      alert("Registro exitoso. Por favor revisa tu correo electrónico para verificar tu cuenta.");
      onSwitchToLogin();
    } catch (err) {"""

content = content.replace(old_submit, new_submit)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch aplicado.")
