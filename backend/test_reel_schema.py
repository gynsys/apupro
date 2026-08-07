from app.blog.schemas import SocialContentResponse
from app.services.social_service import generate_social_content
import app.services.social_service

def mock_call_llm_json(prompt, use_case="social"):
    # Return a structure matching what we instructed the AI to output
    return {
        "video_slides": [
            {
                "text": "TÍTULO: Explicación técnica profunda y detallada del concepto. No resumas demasiado. Aquí hay mucha información."
            },
            {
                "text": "SEGUNDA DIAPOSITIVA: Más explicación técnica. Es fundamental detallar cada punto."
            }
        ],
        "music_suggestion": "Música inspiradora tecnológica",
        "duration_per_slide": 5,
        "total_duration": 40
    }

# Mock the actual LLM call to bypass database and network
app.services.social_service.call_llm_json = mock_call_llm_json

def test_schema():
    print("Generating mock content...")
    result = generate_social_content(
        post_title="Estructuras de Vanguardia",
        post_content="Este es el contenido original detallado del post.",
        generation_type="reel"
    )
    
    print("Mock Result:", result)
    
    # We must also inject "type" which is usually injected by the caller or router
    # wait, the router does this:
    # if isinstance(data, dict): data["type"] = gen_type
    result["type"] = "video"
    
    print("\nValidating against SocialContentResponse schema...")
    try:
        # FastAPI does this under the hood when returning the response
        validated = SocialContentResponse.model_validate(result)
        print("\nSUCCESS! The schema validation passed perfectly.")
        print(validated.model_dump_json(indent=2))
    except Exception as e:
        print("\nERROR! Schema validation failed:")
        print(e)

if __name__ == "__main__":
    test_schema()
