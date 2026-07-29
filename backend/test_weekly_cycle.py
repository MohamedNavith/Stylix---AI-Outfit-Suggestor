import sys
import os
import json

sys.path.append(os.path.dirname(__file__))

from database import EncryptedDatabase
from agents.coordinator import CoordinatorAgent

def run_simulation():
    print("==================================================")
    print("     STYLIX MULTI-USER WEEKLY CYCLE SIMULATION    ")
    print("==================================================")
    
    test_user = "admin"
    
    # 1. Reset/Initialize Database
    print("\n[Step 1] Initializing Encrypted Database...")
    db = EncryptedDatabase()
    db.data = db._get_initial_schema()
    db.save()
    
    print(f"Total wardrobe items cataloged for '{test_user}': {len(db.get_wardrobe(test_user))}")
    clean_count = sum(1 for i in db.get_wardrobe(test_user) if i["is_clean"])
    print(f"Clean items available: {clean_count}")
    
    # 2. Initialize Coordinator
    coordinator = CoordinatorAgent(db)
    
    # 3. Simulate Onboarding quiz
    print("\n[Step 2] Simulating Style Onboarding Quiz...")
    onboarding_data = {
        "preferred_colors": ["navy", "white", "black", "indigo"],
        "avoided_colors": ["yellow"],
        "avoided_styles": ["preppy"],
        "formality_bias": "smart-casual"
    }
    # 3. Simulate Onboarding quiz
    print("\n[Step 2] Simulating Style Onboarding Quiz...")
    onboarding_data = {
        "preferred_colors": ["navy", "white", "black", "indigo"],
        "avoided_colors": ["yellow"],
        "avoided_styles": ["preppy"],
        "formality_bias": "smart-casual"
    }
    coordinator.stylist_agent.initialize_onboarding(test_user, onboarding_data)
    print("Profile weights initialized:")
    profile = db.get_style_profile(test_user)
    print(f" -> Color weights: {json.dumps(profile['color_weights'])}")
    
    # 4. Generate the weekly cycle
    print("\n[Step 3] Running Coordinator Agent: Weekly Cycle Generation...")
    plan = coordinator.generate_weekly_cycle(test_user)
    
    print("\n=== Generated 6-Day Plan ===")
    for day in plan:
        outfit_desc = ", ".join([f"{item['color']} {item['name']} ({item['category']})" for item in day['assigned_outfit']])
        print(f"{day['day_name']} | Occasion: {day['occasion']}")
        print(f"  -> Outfit: {outfit_desc}")
    
    # 5. Simulate Day 0: Monday Worn & Thumbs Up Feedback
    print("\n[Step 4] Simulating Monday (Day 0) Feedback...")
    monday_outfit = plan[0]['assigned_outfit']
    monday_items_desc = [f"{item['name']} ({item['color']})" for item in monday_outfit]
    print(f"User wore Monday's outfit: {', '.join(monday_items_desc)}")
    
    # Confirm outfit worn
    success = coordinator.confirm_day_worn(test_user, day_index=0, rating="thumbsup")
    print(f"Feedback Submission success: {success}")
    
    # Check weights update
    updated_profile = db.get_style_profile(test_user)
    print("\nChecking updated style profile color weights:")
    for item in monday_outfit:
        color = item["color"]
        print(f" -> {color}: {updated_profile['color_weights'].get(color, 1.0):.2f}")
        
    # Check laundry
    print("\nChecking Laundry & Rotation Status:")
    laundry_stats = coordinator.wardrobe_agent.get_laundry_stats(test_user)
    print(f" -> Clean items: {laundry_stats['clean_count']}")
    print(f" -> Dirty items (in wash): {laundry_stats['dirty_count']}")
    
    # 6. Simulate Running Laundry
    print("\n[Step 5] Running Laundry Cycle (Wash and Dry)...")
    cleaned = coordinator.wardrobe_agent.clean_all_dirty_items(test_user)
    print(f" -> Cleaned {cleaned} items.")
    laundry_stats_after = coordinator.wardrobe_agent.get_laundry_stats(test_user)
    print(f" -> Clean items: {laundry_stats_after['clean_count']} | Dirty items: {laundry_stats_after['dirty_count']}")
    
    print("\n==================================================")
    print("      SIMULATION COMPLETED SUCCESSFULY - PAKKA!   ")
    print("==================================================")

if __name__ == "__main__":
    run_simulation()
