import os
import base64
import json
import uuid
import sys
import httpx
from dotenv import load_dotenv

# Ensure backend directory is in path
sys.path.append(os.path.dirname(__file__))

from database import EncryptedDatabase, SUPABASE_URL
from agents.coordinator import CoordinatorAgent

load_dotenv()

def get_base64_data_url(filepath: str) -> str:
    _, ext = os.path.splitext(filepath)
    ext = ext.lower().replace(".", "")
    if ext == "jpg":
        ext = "jpeg"
    mime_type = f"image/{ext}"
    
    with open(filepath, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
        
    return f"data:{mime_type};base64,{data}"

def catalog_filename_with_groq(filename: str, groq_key: str) -> dict:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {groq_key}",
        "Content-Type": "application/json"
    }
    
    prompt = (
        f"Analyze this clothing item filename: '{filename}'. "
        "Output a strict JSON object with these fields:\n"
        "1. name (a short, formatted description like 'Faded Green Pant')\n"
        "2. category (must be exactly one of: 'top', 'bottom', 'outerwear', 'footwear', 'accessory')\n"
        "3. color (primary color of the item, like 'navy', 'black', 'white', 'beige', 'green', 'yellow', 'red', 'pink', 'teal', 'blue', 'grey')\n"
        "4. fabric (fabric type, like 'denim', 'cotton', 'wool', 'linen', 'polyester', etc.)\n"
        "5. formality (must be exactly one of: 'casual', 'smart-casual', 'formal')\n"
        "6. pattern (like 'solid', 'stripes', 'checkered', 'graphic', 'floral', 'patterned', etc.)\n"
        "7. style_tag (like 'minimalist', 'streetwear', 'classic', 'athletic', 'refined')\n"
        "Keep the JSON values concise and strictly aligned to these values."
    )
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"}
    }
    
    res = httpx.post(url, json=payload, headers=headers, timeout=20.0)
    if res.status_code == 200:
        return json.loads(res.json()["choices"][0]["message"]["content"])
    else:
        # Fallback tagging
        name_clean = os.path.splitext(filename)[0].replace("_", " ").title()
        category = "top"
        if "pant" in filename.lower():
            category = "bottom"
        return {
            "name": name_clean,
            "category": category,
            "color": "white",
            "fabric": "cotton",
            "formality": "casual",
            "pattern": "solid",
            "style_tag": "classic"
        }

def is_duplicate(new_item: dict, wardrobe: list) -> bool:
    new_name = new_item.get("name", "").strip().lower()
    for item in wardrobe:
        if item.get("name", "").strip().lower() == new_name:
            return True
            
    # Check if category, color, fabric, pattern, and formality are all identical
    for item in wardrobe:
        if (item.get("category") == new_item.get("category") and
            item.get("color") == new_item.get("color") and
            item.get("fabric") == new_item.get("fabric") and
            item.get("pattern") == new_item.get("pattern") and
            item.get("formality") == new_item.get("formality")):
            return True
            
    return False

def main():
    print("Initializing Encrypted Database...")
    db = EncryptedDatabase()
    username = "MohamedNavith"
    
    # 1. Update User Profile settings
    print(f"Updating user profile settings for {username}...")
    user_updates = {
        "name": "Mohamed Navith H",
        "birthday": "2005-06-02",
        "gender": "male",
        "email": "name@domain.com",
        "mobile": "+919876543210",
        "whatsapp_linked": True,
        "telegram_linked": True
    }
    success = db.update_user_settings(username, user_updates)
    print(f"Profile update success: {success}")
    
    # 2. Get existing wardrobe to prevent duplicate imports
    existing_wardrobe = db.get_wardrobe(username, select_cols="id,name,category,color,fabric,formality,pattern,style_tag")
    print(f"Current wardrobe item count: {len(existing_wardrobe)}")
    
    # 3. Read files from downloads folder
    downloads_dir = r"C:\Users\moham\Downloads\Dress Suggestion APP test\SHIRT"
    if not os.path.exists(downloads_dir):
        print(f"Error: Directory {downloads_dir} does not exist.")
        return
        
    groq_key = os.environ.get("GROQ_API_KEY") or os.environ.get("GROK_API_KEY")
    if not groq_key:
        try:
            from config_keys import DEFAULT_GROQ_API_KEY
            groq_key = DEFAULT_GROQ_API_KEY
        except ImportError:
            pass
            
    if not groq_key:
        print("Error: Groq API key not found in environment or config_keys.py.")
        return

    files = [f for f in os.listdir(downloads_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Found {len(files)} clothing images to import.")
    
    imported_count = 0
    duplicate_count = 0
    
    for filename in files:
        filepath = os.path.join(downloads_dir, filename)
        print(f"\nProcessing: {filename}...")
        
        # Extract tags using Groq
        tags = catalog_filename_with_groq(filename, groq_key)
        print(f" -> Analyzed tags: {json.dumps(tags)}")
        
        # Check duplicate
        if is_duplicate(tags, existing_wardrobe):
            print(f" -> Duplicate detected! Skipping import for {filename}.")
            duplicate_count += 1
            continue
            
        # Get base64 Data URL
        try:
            image_data = get_base64_data_url(filepath)
        except Exception as e:
            print(f" -> Error reading image file: {e}")
            continue
            
        # Construct item
        new_item = {
            "id": f"item_{uuid.uuid4().hex[:8]}",
            "name": tags.get("name", "New Item"),
            "category": tags.get("category", "top"),
            "color": tags.get("color", "white"),
            "fabric": tags.get("fabric", "cotton"),
            "formality": tags.get("formality", "casual"),
            "pattern": tags.get("pattern", "solid"),
            "style_tag": tags.get("style_tag", "classic"),
            "is_clean": True,
            "last_worn_date": None,
            "image_data": image_data,
            "mesh_type": "shirt" if tags.get("category") == "top" else "pant" if tags.get("category") == "bottom" else "coat"
        }
        
        # Add to database
        item_id = db.add_wardrobe_item(username, new_item)
        if item_id:
            print(f" -> Successfully imported as ID: {item_id}")
            imported_count += 1
            # Add to local list to check duplicates against newly added items in this run
            existing_wardrobe.append(new_item)
        else:
            print(f" -> Error: Failed to add item to database.")
            
    print(f"\nImport Finished: {imported_count} imported, {duplicate_count} duplicates skipped.")
    
    # 4. Generate outfit combinations and shuffle for a week
    print("\nGenerating weekly schedule and outfit recommendations...")
    coordinator = CoordinatorAgent(db)
    weekly_plan = coordinator.generate_weekly_cycle(username)
    print("Weekly suggestion cycle generated successfully!")
    
    print("\n=== Weekly Shuffled Recommendations ===")
    for day in weekly_plan:
        outfit_desc = ", ".join([f"{item['color']} {item['name']}" for item in day['assigned_outfit']])
        print(f"{day['day_name']} | Occasion: {day['occasion']} -> Outfit: {outfit_desc}")

if __name__ == "__main__":
    main()
