import random
from typing import Dict, List, Any, Tuple, Optional
from database import EncryptedDatabase

class OutfitGenerationAgent:
    def __init__(self, db: EncryptedDatabase):
        self.db = db

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

        clashes = [
            ("brown", "black"), ("navy", "black"), ("olive", "navy")
        ]
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
        
        # 1. Apply style profile weights
        score *= profile.get("color_weights", {}).get(color, 1.0)
        score *= profile.get("formality_weights", {}).get(formality, 1.0)
        score *= profile.get("pattern_weights", {}).get(pattern, 1.0)
        
        # 2. Formality Matching
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
        """
        Outfit Generation Agent: Selects outfits for the 6-day cycle scoped to username.
        """
        all_items = self.db.get_wardrobe(username)
        profile = self.db.get_style_profile(username)
        
        used_item_ids = set()
        updated_plan = []
        
        for day in context_list:
            clean_pool = [item for item in all_items if item["is_clean"] and item["id"] not in used_item_ids]
            
            tops = [i for i in clean_pool if i["category"] == "top"]
            bottoms = [i for i in clean_pool if i["category"] == "bottom"]
            footwear = [i for i in clean_pool if i["category"] == "footwear"]
            
            # Recovery fallback
            if not tops:
                tops = [i for i in all_items if i["category"] == "top" and i["is_clean"]]
            if not bottoms:
                bottoms = [i for i in all_items if i["category"] == "bottom" and i["is_clean"]]
            if not footwear:
                footwear = [i for i in all_items if i["category"] == "footwear" and i["is_clean"]]
                
            if not tops:
                tops = [i for i in all_items if i["category"] == "top"]
            if not bottoms:
                bottoms = [i for i in all_items if i["category"] == "bottom"]
            if not footwear:
                footwear = [i for i in all_items if i["category"] == "footwear"]

            best_combo = None
            best_score = -999.0
            
            # Score items
            scored_tops = [(t, self.score_item(t, day, profile)) for t in tops]
            scored_bottoms = [(b, self.score_item(b, day, profile)) for b in bottoms]
            scored_footwear = [(f, self.score_item(f, day, profile)) for f in footwear]
            
            scored_tops.sort(key=lambda x: x[1], reverse=True)
            scored_bottoms.sort(key=lambda x: x[1], reverse=True)
            scored_footwear.sort(key=lambda x: x[1], reverse=True)
            
            top_candidates_tops = scored_tops[:3]
            top_candidates_bottoms = scored_bottoms[:3]
            top_candidates_footwear = scored_footwear[:3]
            
            for t_item, t_score in top_candidates_tops:
                for b_item, b_score in top_candidates_bottoms:
                    for f_item, f_score in top_candidates_footwear:
                        combo_score = t_score + b_score + f_score
                        color_score = self.get_color_harmony_score(t_item["color"], b_item["color"])
                        combo_score += color_score
                        
                        if f_item["formality"] == "formal" and (t_item["formality"] == "casual" or b_item["formality"] == "casual"):
                            combo_score -= 1.5
                            
                        if combo_score > best_score:
                            best_score = combo_score
                            best_combo = (t_item, b_item, f_item)

            assigned_outfit_ids = []
            assigned_outfit_details = []
            
            if best_combo:
                t_sel, b_sel, f_sel = best_combo
                assigned_outfit_ids.extend([t_sel["id"], b_sel["id"], f_sel["id"]])
                assigned_outfit_details.extend([t_sel, b_sel, f_sel])
                
                used_item_ids.add(t_sel["id"])
                used_item_ids.add(b_sel["id"])
                used_item_ids.add(f_sel["id"])
                
                # Check for outerwear necessity (only for work presentation or cold events)
                # Since weather is disabled, we check occasion types
                occasion = day["occasion"].lower()
                if "client" in occasion or "office" in occasion:
                    outerwear_pool = [i for i in clean_pool if i["category"] == "outerwear" and i["id"] not in used_item_ids]
                    if not outerwear_pool:
                        outerwear_pool = [i for i in all_items if i["category"] == "outerwear" and i["is_clean"]]
                    
                    if outerwear_pool:
                        scored_outer = [(o, self.score_item(o, day, profile)) for o in outerwear_pool]
                        scored_outer.sort(key=lambda x: x[1], reverse=True)
                        best_outer = scored_outer[0][0]
                        assigned_outfit_ids.append(best_outer["id"])
                        assigned_outfit_details.append(best_outer)
                        used_item_ids.add(best_outer["id"])
            
            outfit_detail_list = []
            for item in assigned_outfit_details:
                outfit_detail_list.append({
                    "id": item["id"],
                    "name": item["name"],
                    "category": item["category"],
                    "color": item["color"],
                    "formality": item["formality"],
                    "style_tag": item["style_tag"]
                })
                
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
