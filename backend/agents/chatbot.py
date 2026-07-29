import os
import json
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from database import EncryptedDatabase

load_dotenv()

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
        print(f"Error initializing Gemini Client for Chatbot: {e}")
        return None

def chat_with_stylist(username: str, message: str) -> str:
    """
    Chatbot Agent: Scopes user data, saves to persistent chat log,
    and returns Gemini or simulated wardrobe advisor comments.
    """
    db = EncryptedDatabase()
    
    # 1. Save user query to history
    db.save_chat_message(username, "user", message)
    
    wardrobe = db.get_wardrobe(username)
    profile = db.get_style_profile(username)
    plan = db.get_routine_plan(username)
    
    client = get_gemini_client()
    reply = ""
    
    if client:
        try:
            wardrobe_summary = []
            for item in wardrobe:
                status = "Clean" if item["is_clean"] else "In Wash (Dirty)"
                wardrobe_summary.append(
                    f"- {item['name']} [ID: {item['id']}]: Category={item['category']}, Color={item['color']}, Formality={item['formality']}, Status={status}"
                )
                
            plan_summary = []
            for slot in plan:
                outfit_desc = "None"
                if slot.get("assigned_outfit"):
                    outfit_desc = ", ".join([f"{i['name']} ({i['color']})" for i in slot["assigned_outfit"]])
                plan_summary.append(
                    f"- {slot['day_name']} ({slot.get('date_label', '')}): Occasion={slot['occasion']}, Outfit={outfit_desc}, Status={slot['status']}"
                )
                
            system_instruction = (
                "You are Stylix AI, a personal stylist chatbot integrated inside the Stylix wardrobe app. "
                "You have access to the user's clothing catalog, style preferences, and current week's schedule. "
                "Keep answers brief, punchy, useful, and stylish. Use the following context to answer precisely:\n\n"
                f"[USER CATALOG]:\n" + "\n".join(wardrobe_summary) + "\n\n"
                f"[STYLE PROFILE]:\n" + json.dumps(profile) + "\n\n"
                f"[WEEKLY PLANNER]:\n" + "\n".join(plan_summary) + "\n\n"
                "Help the user decide what to wear, suggest changes, check if clothes are clean, or explain how their laundry rotation works. "
                "Avoid meta-language. Respond in a helpful, direct tone."
            )
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=message,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7
                )
            )
            reply = response.text.strip()
        except Exception as e:
            print(f"Gemini Chatbot Error: {e}. Falling back to simulation.")

    # 2. Rule-Based Simulation Fallback
    if not reply:
        msg_lower = message.lower()
        if "clean" in msg_lower:
            clean_tops = [i["name"] for i in wardrobe if i["category"] == "top" and i["is_clean"]]
            clean_bottoms = [i["name"] for i in wardrobe if i["category"] == "bottom" and i["is_clean"]]
            if "shirt" in msg_lower or "top" in msg_lower:
                reply = f"You currently have these clean tops: {', '.join(clean_tops[:3])}."
            elif "pant" in msg_lower or "chino" in msg_lower or "jean" in msg_lower or "bottom" in msg_lower:
                reply = f"These bottoms are clean: {', '.join(clean_bottoms[:3])}."
            else:
                reply = f"Your clean pool has {sum(1 for i in wardrobe if i['is_clean'])} items clean, and {sum(1 for i in wardrobe if not i['is_clean'])} in the wash."
        elif "dirty" in msg_lower or "wash" in msg_lower or "laundry" in msg_lower:
            dirty_items = [i["name"] for i in wardrobe if not i["is_clean"]]
            if not dirty_items:
                reply = "All your clothes are clean! No need to run the laundry cycle."
            else:
                reply = f"These items are currently dirty: {', '.join(dirty_items)}. Run the Laundry Cycle to clean them."
        elif "suggest" in msg_lower or "wear" in msg_lower or "outfit" in msg_lower:
            clean_tops = [i for i in wardrobe if i["category"] == "top" and i["is_clean"]]
            clean_bottoms = [i for i in wardrobe if i["category"] == "bottom" and i["is_clean"]]
            clean_shoes = [i for i in wardrobe if i["category"] == "footwear" and i["is_clean"]]
            if clean_tops and clean_bottoms:
                t = clean_tops[0]
                b = clean_bottoms[0]
                f = clean_shoes[0] if clean_shoes else {"name": "sneakers", "color": "white"}
                reply = f"I recommend pairing the **{t['name']}** ({t['color']}) with the **{b['name']}** ({b['color']}), finished with your **{f['name']}**."
            else:
                reply = "I need more clean items cataloged in your wardrobe to generate custom outfit suggestions."
        else:
            reply = (
                "Hello! I am your Stylix AI wardrobe coach. "
                "Ask me about clean items, dirty items, or outfit recommendations."
            )

    # 3. Save assistant reply to history
    db.save_chat_message(username, "assistant", reply)
    return reply
