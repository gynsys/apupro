import sys

file_path = r"c:\Users\pablo\Documents\apupro_platform\frontend\src\App.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import_verify = "import VerifyEmail from './pages/VerifyEmail.jsx';\n"
if "VerifyEmail" not in content:
    content = content.replace("import ResetPassword", import_verify + "import ResetPassword")

route_verify = "<Route path=\"/verify-email\" element={<VerifyEmail />} />\n"
if "/verify-email" not in content:
    content = content.replace("<Route path=\"/reset-password\"", route_verify + "            <Route path=\"/reset-password\"")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch aplicado a App.jsx")
