from typing import Dict, List, Any, Optional
from database import EncryptedDatabase

# Multiplier constants for learning updates
THUMBS_UP_BOOST = 0.2
THUMBS_DOWN_PENALTY = 0.3
WORN_BOOST = 0.05
SKIPPED_PENALTY = 0.1
SWAPPED_PENALTY = 0.08

class StyleProfileAgent:
    def __init__(self, db: EncryptedDatabase):
        self.db = db

    def get_profile(self, username: str) -> Dict[str, Any]:
        return self.db.get_style_profile(username)

    def initialize_onboarding(self, username: str, data: Dict[str, Any]):
        """
        Setup the profile based on onboarding preferences.
        """
        profile = self.get_profile(username)
        if not profile:
            return
            
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
        """
        Adjust preference weights for a specific clothing item's features.
        """
        profile = self.get_profile(username)
        if not profile:
            return
            
        color = item.get("color", "").lower()
        formality = item.get("formality", "").lower()
        pattern = item.get("pattern", "").lower()
        
        # 1. Update Color Weights
        if color:
            current_color_w = profile.get("color_weights", {}).get(color, 1.0)
            if "color_weights" not in profile:
                profile["color_weights"] = {}
            profile["color_weights"][color] = max(0.1, min(3.0, current_color_w + weight_change))
            
        # 2. Update Formality Weights
        if formality:
            current_form_w = profile.get("formality_weights", {}).get(formality, 1.0)
            if "formality_weights" not in profile:
                profile["formality_weights"] = {}
            profile["formality_weights"][formality] = max(0.1, min(3.0, current_form_w + weight_change))
            
        # 3. Update Pattern Weights
        if pattern:
            current_pattern_w = profile.get("pattern_weights", {}).get(pattern, 1.0)
            if "pattern_weights" not in profile:
                profile["pattern_weights"] = {}
            profile["pattern_weights"][pattern] = max(0.1, min(3.0, current_pattern_w + weight_change))
            
        self.db.update_style_profile(username, profile)

    def process_outfit_feedback(self, username: str, outfit_items: List[Dict[str, Any]], feedback_type: str, rating: Optional[str] = None):
        """
        Process user action (worn, skipped, swapped) and rating (thumbsup, thumbsdown).
        Updates preference weights.
        """
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
            
        # Apply the change to all items in the outfit
        for item in outfit_items:
            self.apply_feedback_to_item(username, item, total_change)
