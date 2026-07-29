import os
import json
import base64
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# We can import google-genai client if installed, otherwise use stub
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

def get_gemini_client() -> Optional[Any]:
    if not HAS_GENAI:
        return None
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Gemini Client: {e}")
        return None

def catalog_clothing_item(image_base64: str, file_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Cataloging Agent: Takes a base64 encoded clothing photo,
    sends it to Gemini Vision to output structured details.
    """
    client = get_gemini_client()
    
    # Define fallback tags in case we are in simulation mode
    fallback_tags = {
        "name": "Custom Clothing Item",
        "category": "top",
        "color": "navy",
        "fabric": "cotton",
        "formality": "casual",
        "pattern": "solid",
        "style_tag": "streetwear"
    }

    # Attempt to guess from file_name if in simulation mode
    if file_name and not client:
        name_lower = file_name.lower()
        if "shirt" in name_lower or "tee" in name_lower or "tshirt" in name_lower:
            fallback_tags.update({"category": "top", "name": file_name.split(".")[0].replace("_", " ").title()})
        elif "pant" in name_lower or "jean" in name_lower or "chino" in name_lower or "trouser" in name_lower:
            fallback_tags.update({"category": "bottom", "name": file_name.split(".")[0].replace("_", " ").title()})
        elif "jacket" in name_lower or "coat" in name_lower or "hoodie" in name_lower:
            fallback_tags.update({"category": "outerwear", "name": file_name.split(".")[0].replace("_", " ").title()})
        elif "shoe" in name_lower or "sneaker" in name_lower or "boot" in name_lower:
            fallback_tags.update({"category": "footwear", "name": file_name.split(".")[0].replace("_", " ").title()})

    if not client:
        # Simulation Mode: Add some realistic variability
        print("Offline/Simulation Mode: Cataloging agent returning simulated tags.")
        return fallback_tags

    try:
        # Prepare image content
        # Base64 string is usually prefixed with 'data:image/...;base64,'
        if "," in image_base64:
            base64_data = image_base64.split(",")[1]
            mime_type = image_base64.split(";")[0].split(":")[1]
        else:
            base64_data = image_base64
            mime_type = "image/jpeg"
            
        image_bytes = base64.b64decode(base64_data)
        
        # Call Gemini 2.5 Flash
        prompt = (
            "Analyze this clothing item photo. Output a strict JSON object with these fields:\n"
            "1. name (a short description like 'Black Denim Jacket')\n"
            "2. category (must be exactly one of: 'top', 'bottom', 'outerwear', 'footwear', 'accessory')\n"
            "3. color (primary color of the item, like 'navy', 'black', 'white', 'beige', etc.)\n"
            "4. fabric (fabric type, like 'denim', 'cotton', 'wool', 'linen', etc.)\n"
            "5. formality (must be exactly one of: 'casual', 'smart-casual', 'formal')\n"
            "6. pattern (like 'solid', 'stripes', 'checkered', 'graphic', 'floral', etc.)\n"
            "7. style_tag (a single aesthetic tag like 'minimalist', 'streetwear', 'classic', 'athletic', 'refined')\n"
            "Keep the JSON values concise and strictly aligned to the category values."
        )

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type,
                ),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        result = json.loads(response.text.strip())
        return result
    except Exception as e:
        print(f"Error in Cataloging Agent: {e}. Falling back to simulation.")
        return fallback_tags
