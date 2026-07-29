from typing import Dict, List, Any, Optional
from database import EncryptedDatabase
from agents.style_profile import StyleProfileAgent

class FeedbackAgent:
    def __init__(self, db: EncryptedDatabase, profile_agent: StyleProfileAgent):
        self.db = db
        self.profile_agent = profile_agent

    def submit_feedback(self, username: str, day_index: int, status: str, rating: Optional[str] = None) -> bool:
        """
        Record feedback for a specific day slot scoped by username.
        """
        plan = self.db.get_routine_plan(username)
        day_slot = None
        for slot in plan:
            if slot["day_index"] == day_index:
                day_slot = slot
                break
                
        if not day_slot:
            return False

        day_slot["status"] = status
        day_slot["rating"] = rating
        self.db.update_routine_plan(username, plan)

        outfit = day_slot.get("assigned_outfit")
        if not outfit:
            return True

        wardrobe = self.db.get_wardrobe(username)
        outfit_items = []
        for outfit_item in outfit:
            for item in wardrobe:
                if item["id"] == outfit_item["id"]:
                    outfit_items.append(item)
                    break
                    
        self.profile_agent.process_outfit_feedback(
            username=username,
            outfit_items=outfit_items,
            feedback_type=status,
            rating=rating
        )

        self.db.log_history(username, {
            "day_index": day_index,
            "day_name": day_slot["day_name"],
            "occasion": day_slot["occasion"],
            "outfit": outfit,
            "status": status,
            "rating": rating
        })

        return True
