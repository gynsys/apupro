from app.services.social_service import generate_social_content

title = "Importancia del Acero Estructural"
content = "El acero es vital para los rascacielos."

try:
    result = generate_social_content(post_title=title, post_content=content, generation_type="carousel")
    print("SUCCESS")
    print(result)
except Exception as e:
    print("FAILED")
    print(e)
