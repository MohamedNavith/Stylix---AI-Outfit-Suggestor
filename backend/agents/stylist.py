import os
import json
import random
from typing import Dict, List, Any, Tuple, Optional
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
    try:
        from config_keys import DEFAULT_GEMINI_API_KEY
    except ImportError:
        DEFAULT_GEMINI_API_KEY = ""
    api_key = os.environ.get("GEMINI_API_KEY") or DEFAULT_GEMINI_API_KEY
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Gemini Client in StylistAgent: {e}")
        return None


# Multiplier constants for learning updates
THUMBS_UP_BOOST = 0.2
THUMBS_DOWN_PENALTY = 0.3
WORN_BOOST = 0.05
SKIPPED_PENALTY = 0.1
SWAPPED_PENALTY = 0.08

class StylistAgent:
    """
    Consolidated Stylist Agent:
    Handles Style Profile, Outfit Recommendation Generation, Feedback, and Chatbot interactions.
    Also handles gender-specific recommendation profiles.
    """
    def __init__(self, db: Optional[EncryptedDatabase] = None):
        self.db = db if db else EncryptedDatabase()

    def get_profile(self, username: str) -> Dict[str, Any]:
        return self.db.get_style_profile(username)

    def initialize_onboarding(self, username: str, data: Dict[str, Any]):
        profile = self.get_profile(username)
        if not profile:
            profile = {}
            
        profile["preferred_colors"] = data.get("preferred_colors", [])
        profile["avoided_colors"] = data.get("avoided_colors", [])
        profile["avoided_styles"] = data.get("avoided_styles", [])
        profile["formality_bias"] = data.get("formality_bias", "smart-casual")
        
        # Re-initialize weights
        profile["color_weights"] = {c: 1.0 for c in profile["preferred_colors"]}
        for c in profile["avoided_colors"]:
            profile["color_weights"][c] = 0.2
            
        profile["formality_weights"] = {
            "casual": 1.0,
            "smart-casual": 1.0,
            "formal": 1.0
        }
        profile["formality_weights"][profile["formality_bias"]] = 1.3
        
        profile["pattern_weights"] = {
            "solid": 1.1,
            "stripes": 1.0,
            "checkered": 1.0,
            "graphic": 1.0,
            "floral": 1.0
        }
        
        self.db.update_style_profile(username, profile)

    def apply_feedback_to_item(self, username: str, item: Dict[str, Any], weight_change: float):
        profile = self.get_profile(username)
        if not profile:
            return
            
        color = item.get("color", "").lower()
        formality = item.get("formality", "").lower()
        pattern = item.get("pattern", "").lower()
        
        if color:
            current_color_w = profile.get("color_weights", {}).get(color, 1.0)
            if "color_weights" not in profile:
                profile["color_weights"] = {}
            profile["color_weights"][color] = max(0.1, min(3.0, current_color_w + weight_change))
            
        if formality:
            current_form_w = profile.get("formality_weights", {}).get(formality, 1.0)
            if "formality_weights" not in profile:
                profile["formality_weights"] = {}
            profile["formality_weights"][formality] = max(0.1, min(3.0, current_form_w + weight_change))
            
        if pattern:
            current_pattern_w = profile.get("pattern_weights", {}).get(pattern, 1.0)
            if "pattern_weights" not in profile:
                profile["pattern_weights"] = {}
            profile["pattern_weights"][pattern] = max(0.1, min(3.0, current_pattern_w + weight_change))
            
        self.db.update_style_profile(username, profile)

    def process_outfit_feedback(self, username: str, outfit_items: List[Dict[str, Any]], feedback_type: str, rating: Optional[str] = None):
        total_change = 0.0
        if rating == "thumbsup":
            total_change += THUMBS_UP_BOOST
        elif rating == "thumbsdown":
            total_change -= THUMBS_DOWN_PENALTY
            
        if feedback_type == "Worn":
            total_change += WORN_BOOST
        elif feedback_type == "Skipped":
            total_change -= SKIPPED_PENALTY
        elif feedback_type == "Swapped":
            total_change -= SWAPPED_PENALTY
            
        if total_change == 0.0:
            return
            
        for item in outfit_items:
            self.apply_feedback_to_item(username, item, total_change)

    def submit_feedback(self, username: str, day_index: int, status: str, rating: Optional[str] = None) -> bool:
        plan = self.db.get_routine_plan(username)
        day_slot = next((slot for slot in plan if slot["day_index"] == day_index), None)
        if not day_slot:
            return False

        day_slot["status"] = status
        day_slot["rating"] = rating
        self.db.update_routine_plan(username, plan)

        outfit = day_slot.get("assigned_outfit")
        if not outfit:
            return True

        wardrobe = self.db.get_wardrobe(username, select_cols="id,color,formality,pattern")
        outfit_items = []
        for outfit_item in outfit:
            for item in wardrobe:
                if item["id"] == outfit_item["id"]:
                    outfit_items.append(item)
                    break
                    
        self.process_outfit_feedback(username, outfit_items, status, rating)
        self.db.log_history(username, {
            "day_index": day_index,
            "day_name": day_slot["day_name"],
            "occasion": day_slot["occasion"],
            "outfit": outfit,
            "status": status,
            "rating": rating
        })
        return True

    def get_color_harmony_score(self, top_color: str, bottom_color: str) -> float:
        neutrals = ["white", "black", "charcoal", "grey", "beige", "sand"]
        tc = top_color.lower()
        bc = bottom_color.lower()

        if tc == bc:
            if tc in ["black", "charcoal", "navy"]:
                return 0.8
            return 0.3

        if tc in neutrals or bc in neutrals:
            return 1.2

        complements = [
            ("navy", "brown"), ("navy", "beige"), ("navy", "camel"),
            ("olive", "beige"), ("olive", "sand"), ("olive", "black"),
            ("indigo", "white"), ("indigo", "beige"), ("indigo", "camel")
        ]
        
        for c1, c2 in complements:
            if (tc == c1 and bc == c2) or (tc == c2 and bc == c1):
                return 1.5

        clashes = [("brown", "black"), ("navy", "black"), ("olive", "navy")]
        for c1, c2 in clashes:
            if (tc == c1 and bc == c2) or (tc == c2 and bc == c1):
                return 0.2

        return 0.8

    def score_item(self, item: Dict[str, Any], day_context: Dict[str, Any], profile: Dict[str, Any]) -> float:
        score = 1.0
        category = item["category"]
        color = item["color"].lower()
        formality = item["formality"].lower()
        pattern = item["pattern"].lower()
        
        score *= profile.get("color_weights", {}).get(color, 1.0)
        score *= profile.get("formality_weights", {}).get(formality, 1.0)
        score *= profile.get("pattern_weights", {}).get(pattern, 1.0)
        
        occasion = day_context["occasion"].lower()
        if "office" in occasion or "work" in occasion or "lunch" in occasion:
            if formality == "smart-casual":
                score += 1.5
            elif formality == "formal":
                score += 1.2
            elif formality == "casual":
                score -= 1.0
        elif "gym" in occasion or "workout" in occasion or "hiking" in occasion:
            if item.get("style_tag") == "athletic" or formality == "casual":
                score += 2.0
            else:
                score -= 2.5
        elif "dinner" in occasion or "night" in occasion or "friday" in occasion:
            if formality == "smart-casual":
                score += 1.5
            elif formality == "casual":
                score += 0.5
        else: # Casual
            if formality == "casual":
                score += 1.5
            elif formality == "smart-casual":
                score += 0.8
            elif formality == "formal":
                score -= 2.0
        return score

    def generate_weekly_plan(self, username: str, context_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        all_items = self.db.get_wardrobe(username, select_cols="id,name,category,color,fabric,formality,pattern,style_tag,is_clean,last_worn_date")
        profile = self.db.get_style_profile(username)
        
        user_info = self.db.get_user(username) or {}
        gender = user_info.get("gender", "male").lower()
        
        used_item_ids = set()
        updated_plan = []
        
        for day in context_list:
            clean_pool = [item for item in all_items if item["is_clean"] and item["id"] not in used_item_ids]
            
            tops = [i for i in clean_pool if i["category"] == "top"]
            bottoms = [i for i in clean_pool if i["category"] == "bottom"]
            footwear = [i for i in clean_pool if i["category"] == "footwear"]
            
            # Fallback
            if not tops: tops = [i for i in all_items if i["category"] == "top" and i["is_clean"]]
            if not bottoms: bottoms = [i for i in all_items if i["category"] == "bottom" and i["is_clean"]]
            if not footwear: footwear = [i for i in all_items if i["category"] == "footwear" and i["is_clean"]]
                
            if not tops: tops = [i for i in all_items if i["category"] == "top"]
            if not bottoms: bottoms = [i for i in all_items if i["category"] == "bottom"]
            if not footwear: footwear = [i for i in all_items if i["category"] == "footwear"]

            best_combo = None
            best_score = -999.0
            
            scored_tops = [(t, self.score_item(t, day, profile)) for t in tops]
            scored_bottoms = [(b, self.score_item(b, day, profile)) for b in bottoms]
            
            scored_tops.sort(key=lambda x: x[1], reverse=True)
            scored_bottoms.sort(key=lambda x: x[1], reverse=True)
            
            if scored_tops and scored_bottoms:
                if footwear:
                    scored_footwear = [(f, self.score_item(f, day, profile)) for f in footwear]
                    scored_footwear.sort(key=lambda x: x[1], reverse=True)
                    
                    for t_item, t_score in scored_tops[:3]:
                        for b_item, b_score in scored_bottoms[:3]:
                            for f_item, f_score in scored_footwear[:3]:
                                combo_score = t_score + b_score + f_score
                                color_score = self.get_color_harmony_score(t_item["color"], b_item["color"])
                                combo_score += color_score
                                
                                if f_item["formality"] == "formal" and (t_item["formality"] == "casual" or b_item["formality"] == "casual"):
                                    combo_score -= 1.5
                                    
                                # Gender Specific Alignment Bonuses
                                if gender == "female":
                                    if "dress" in t_item["name"].lower() or t_item.get("mesh_type") == "dress":
                                        combo_score += 1.0
                                
                                if combo_score > best_score:
                                    best_score = combo_score
                                    best_combo = (t_item, b_item, f_item)
                else:
                    for t_item, t_score in scored_tops[:3]:
                        for b_item, b_score in scored_bottoms[:3]:
                            combo_score = t_score + b_score
                            color_score = self.get_color_harmony_score(t_item["color"], b_item["color"])
                            combo_score += color_score
                            
                            # Gender Specific Alignment Bonuses
                            if gender == "female":
                                if "dress" in t_item["name"].lower() or t_item.get("mesh_type") == "dress":
                                    combo_score += 1.0
                            
                            if combo_score > best_score:
                                best_score = combo_score
                                best_combo = (t_item, b_item, None)

            assigned_outfit_details = []
            if best_combo:
                t_sel, b_sel, f_sel = best_combo
                assigned_outfit_details.append(t_sel)
                assigned_outfit_details.append(b_sel)
                used_item_ids.update([t_sel["id"], b_sel["id"]])
                if f_sel:
                    assigned_outfit_details.append(f_sel)
                    used_item_ids.add(f_sel["id"])
                
                # Outerwear check
                occasion = day["occasion"].lower()
                if "client" in occasion or "office" in occasion:
                    outerwear_pool = [i for i in clean_pool if i["category"] == "outerwear" and i["id"] not in used_item_ids]
                    if not outerwear_pool:
                        outerwear_pool = [i for i in all_items if i["category"] == "outerwear" and i["is_clean"]]
                    if outerwear_pool:
                        scored_outer = [(o, self.score_item(o, day, profile)) for o in outerwear_pool]
                        scored_outer.sort(key=lambda x: x[1], reverse=True)
                        best_outer = scored_outer[0][0]
                        assigned_outfit_details.append(best_outer)
                        used_item_ids.add(best_outer["id"])
            
            outfit_detail_list = [{
                "id": item["id"],
                "name": item["name"],
                "category": item["category"],
                "color": item["color"],
                "formality": item["formality"],
                "style_tag": item["style_tag"],
                "mesh_type": item.get("mesh_type", ""),
                "texture_map": item.get("texture_map", "")
            } for item in assigned_outfit_details]
                
            updated_plan.append({
                "day_index": day["day_index"],
                "day_name": day["day_name"],
                "date_label": day["date_label"],
                "occasion": day["occasion"],
                "assigned_outfit": outfit_detail_list,
                "status": "Planned",
                "rating": None
            })
        return updated_plan

    def chat_with_stylist(self, username: str, message: str) -> str:
        self.db.save_chat_message(username, "user", message)
        wardrobe = self.db.get_wardrobe(username, select_cols="id,name,category,color,formality,is_clean")
        profile = self.get_profile(username)
        plan = self.db.get_routine_plan(username)
        user_info = self.db.get_user(username) or {}
        
        name = user_info.get("name", username)
        gender = user_info.get("gender", "male")
        
        reply = ""
        
        # Build context
        wardrobe_summary = [
            f"- {item['name']} [ID: {item['id']}]: Category={item['category']}, Color={item['color']}, Formality={item['formality']}, Status={'Clean' if item['is_clean'] else 'Dirty'}"
            for item in wardrobe
        ]
        plan_summary = []
        for slot in plan:
            outfit_desc = ", ".join([f"{i['name']} ({i['color']})" for i in slot["assigned_outfit"]]) if slot.get("assigned_outfit") else "None"
            plan_summary.append(f"- {slot['day_name']} ({slot.get('date_label', '')}): Occasion={slot['occasion']}, Outfit={outfit_desc}, Status={slot['status']}")
        
        system_instruction = (
            f"You are Stylix AI, a personal stylist chatbot integrated inside the Stylix wardrobe app. "
            f"The user is {name}, who identifies as {gender}. "
            "You have access to the user's clothing catalog, style preferences, and current week's schedule. "
            "Keep answers brief, punchy, useful, and stylish. Use the following context to answer precisely:\n\n"
            f"[USER CATALOG]:\n" + "\n".join(wardrobe_summary) + "\n\n"
            f"[STYLE PROFILE]:\n" + json.dumps(profile) + "\n\n"
            f"[WEEKLY PLANNER]:\n" + "\n".join(plan_summary) + "\n\n"
            "Help the user decide what to wear, suggest changes, check if clothes are clean, or explain how their laundry rotation works. "
            "IMPORTANT: Always format your response cleanly using markdown list bullets (*), bold text (**), and headings if helpful. "
            "Use emojis for categories (e.g. 👕 for shirts, 👖 for pants, 🧺 for laundry, 📅 for schedules). "
            "Never output plain paragraphs without styling—keep lists structured, clear, and highly organized."
        )

        # 1. Try Groq (groq.com) API
        try:
            from config_keys import DEFAULT_GROQ_API_KEY
        except ImportError:
            DEFAULT_GROQ_API_KEY = ""
        groq_key = os.environ.get("GROQ_API_KEY") or DEFAULT_GROQ_API_KEY
        if groq_key:
            try:
                import httpx
                headers = {
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": message}
                    ],
                    "temperature": 0.7
                }
                res = httpx.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=20.0)
                if res.status_code == 200:
                    reply = res.json()["choices"][0]["message"]["content"].strip()
                    print("Groq Chatbot response generated successfully.")
                else:
                    print(f"Groq API returned error: {res.status_code} - {res.text}")
            except Exception as e:
                print(f"Groq API call failed: {e}")

        # 2. Fallback to Gemini API
        if not reply:
            client = get_gemini_client()
            if client:
                try:
                    response = client.models.generate_content(
                        model='gemini-2.0-flash',
                        contents=message,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.7
                        )
                    )
                    reply = response.text.strip()
                    print("Gemini Chatbot response generated successfully (fallback).")
                except Exception as e:
                    print(f"Gemini Chatbot Error (fallback): {e}. Falling back to simulation.")

        # 3. Fallback to local rule-based simulation
        if not reply:
            msg_lower = message.lower()
            if "clean" in msg_lower:
                clean_tops = [i["name"] for i in wardrobe if i["category"] == "top" and i["is_clean"]]
                reply = f"You currently have these clean tops: {', '.join(clean_tops[:3])}."
            elif "dirty" in msg_lower or "wash" in msg_lower or "laundry" in msg_lower:
                dirty_items = [i["name"] for i in wardrobe if not i["is_clean"]]
                reply = f"These items are currently dirty: {', '.join(dirty_items)}. Run the Laundry Cycle to clean them."
            else:
                reply = f"Hello {name}! I am your Stylix AI wardrobe coach. Let me know if you need outfit combinations or recommendations for your upcoming {gender} outfits!"

        self.db.save_chat_message(username, "assistant", reply)
        return reply
