from typing import List, Dict, Any
from database import EncryptedDatabase

class LaundryAgent:
    def __init__(self, db: EncryptedDatabase):
        self.db = db

    def flag_items_as_dirty(self, username: str, item_ids: List[str]) -> bool:
        success = True
        for item_id in item_ids:
            if not self.db.update_wardrobe_item(username, item_id, {"is_clean": False}):
                success = False
        return success

    def clean_all_dirty_items(self, username: str) -> int:
        wardrobe = self.db.get_wardrobe(username)
        count = 0
        for item in wardrobe:
            if not item["is_clean"]:
                self.db.update_wardrobe_item(username, item["id"], {"is_clean": True})
                count += 1
        return count

    def get_laundry_stats(self, username: str) -> Dict[str, Any]:
        wardrobe = self.db.get_wardrobe(username)
        clean_count = sum(1 for item in wardrobe if item["is_clean"])
        dirty_count = sum(1 for item in wardrobe if not item["is_clean"])
        
        dirty_items = [{
            "id": item["id"],
            "name": item["name"],
            "category": item["category"],
            "color": item["color"]
        } for item in wardrobe if not item["is_clean"]]
        
        return {
            "clean_count": clean_count,
            "dirty_count": dirty_count,
            "dirty_items": dirty_items
        }
