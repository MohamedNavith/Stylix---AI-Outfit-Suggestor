from typing import Dict, List, Any, Optional
from database import EncryptedDatabase
from agents.context import ContextAgent
from agents.style_profile import StyleProfileAgent
from agents.generation import OutfitGenerationAgent
from agents.feedback import FeedbackAgent
from agents.laundry import LaundryAgent

class CoordinatorAgent:
    def __init__(self, db: Optional[EncryptedDatabase] = None):
        self.db = db if db else EncryptedDatabase()
        self.context_agent = ContextAgent()
        self.profile_agent = StyleProfileAgent(self.db)
        self.generation_agent = OutfitGenerationAgent(self.db)
        self.feedback_agent = FeedbackAgent(self.db, self.profile_agent)
        self.laundry_agent = LaundryAgent(self.db)

    def generate_weekly_cycle(self, username: str) -> List[Dict[str, Any]]:
        """
        Runs context compilation and scopes outfit generation by username.
        """
        context_list = self.context_agent.get_6day_context()
        generated_plan = self.generation_agent.generate_weekly_plan(username, context_list)
        self.db.update_routine_plan(username, generated_plan)
        return generated_plan

    def confirm_day_worn(self, username: str, day_index: int, rating: Optional[str] = None) -> bool:
        plan = self.db.get_routine_plan(username)
        day_slot = next((d for d in plan if d["day_index"] == day_index), None)
        if not day_slot:
            return False
            
        outfit = day_slot.get("assigned_outfit")
        if not outfit:
            return False

        # Confirm outfit worn scoping to username
        success = self.feedback_agent.submit_feedback(username, day_index, "Worn", rating)
        if not success:
            return False

        # Flag items as dirty in laundry bucket scoping to username
        item_ids = [item["id"] for item in outfit]
        self.laundry_agent.flag_items_as_dirty(username, item_ids)
        return True

    def skip_day_outfit(self, username: str, day_index: int) -> bool:
        return self.feedback_agent.submit_feedback(username, day_index, "Skipped", None)

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
                    "style_tag": item_detail["style_tag"]
                })

        if not swapped_items:
            return False

        day_slot["assigned_outfit"] = swapped_items
        day_slot["status"] = "Swapped"
        self.db.update_routine_plan(username, plan)

        self.feedback_agent.submit_feedback(username, day_index, "Swapped", None)
        self.laundry_agent.flag_items_as_dirty(username, new_item_ids)
        return True
