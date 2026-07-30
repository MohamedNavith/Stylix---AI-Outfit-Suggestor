import datetime
from typing import Dict, List, Any, Optional
from database import EncryptedDatabase
from agents.wardrobe import WardrobeAgent
from agents.stylist import StylistAgent

class CoordinatorAgent:
    """
    Consolidated Coordinator Agent:
    Acts as the orchestrator to resolve weekly calendar context, link wardrobe status,
    and generate schedule plans by combining WardrobeAgent and StylistAgent.
    """
    def __init__(self, db: Optional[EncryptedDatabase] = None):
        self.db = db if db else EncryptedDatabase()
        self.wardrobe_agent = WardrobeAgent(self.db)
        self.stylist_agent = StylistAgent(self.db)

    def get_calendar_events(self, gender: str = "male") -> List[str]:
        if gender == "female":
            return [
                "OFFICE PRESENTATION",
                "GIRLS NIGHT OUT",
                "CASUAL FRIDAY",
                "WEEKEND BRUNCH",
                "FAMILY DINNER",
                "REST DAY"
            ]
        return [
            "OFFICE DAY",
            "CLIENT LUNCH",
            "CASUAL FRIDAY",
            "CASUAL DAY",
            "WEEKEND OUTING",
            "REST DAY"
        ]

    def get_6day_context(self, username: str) -> List[Dict[str, Any]]:
        user_info = self.db.get_user(username) or {}
        gender = user_info.get("gender", "male").lower()
        calendar_events = self.get_calendar_events(gender)
        
        today = datetime.date.today()
        context_list = []
        for i in range(6):
            target_date = today + datetime.timedelta(days=i)
            day_name = target_date.strftime("%a")
            date_label = target_date.strftime("%b %d")
            context_list.append({
                "day_index": i,
                "day_name": day_name,
                "date_label": date_label,
                "occasion": calendar_events[i] if i < len(calendar_events) else "CASUAL DAY"
            })
        return context_list

    def generate_weekly_cycle(self, username: str) -> List[Dict[str, Any]]:
        context_list = self.get_6day_context(username)
        generated_plan = self.stylist_agent.generate_weekly_plan(username, context_list)
        self.db.update_routine_plan(username, generated_plan)
        return generated_plan

    def confirm_day_worn(self, username: str, day_index: int, rating: Optional[str] = None) -> bool:
        plan = self.db.get_routine_plan(username)
        day_slot = next((d for d in plan if d["day_index"] == day_index), None)
        if not day_slot or not day_slot.get("assigned_outfit"):
            return False
            
        success = self.stylist_agent.submit_feedback(username, day_index, "Worn", rating)
        if not success:
            return False

        item_ids = [item["id"] for item in day_slot["assigned_outfit"]]
        self.wardrobe_agent.flag_items_as_dirty(username, item_ids)
        return True

    def skip_day_outfit(self, username: str, day_index: int) -> bool:
        return self.stylist_agent.submit_feedback(username, day_index, "Skipped", None)

    def swap_day_outfit(self, username: str, day_index: int, new_item_ids: List[str]) -> bool:
        plan = self.db.get_routine_plan(username)
        day_slot = next((d for d in plan if d["day_index"] == day_index), None)
        if not day_slot:
            return False

        wardrobe = self.db.get_wardrobe(username)
        swapped_items = []
        for item_id in new_item_ids:
            item_detail = next((item for item in wardrobe if item["id"] == item_id), None)
            if item_detail:
                swapped_items.append({
                    "id": item_detail["id"],
                    "name": item_detail["name"],
                    "category": item_detail["category"],
                    "color": item_detail["color"],
                    "formality": item_detail["formality"],
                    "style_tag": item_detail["style_tag"],
                    "mesh_type": item_detail.get("mesh_type", ""),
                    "texture_map": item_detail.get("texture_map", ""),
                    "image_data": item_detail.get("image_data", None)
                })

        if not swapped_items:
            return False

        day_slot["assigned_outfit"] = swapped_items
        day_slot["status"] = "Swapped"
        self.db.update_routine_plan(username, plan)

        self.stylist_agent.submit_feedback(username, day_index, "Swapped", None)
        self.wardrobe_agent.flag_items_as_dirty(username, new_item_ids)
        return True
