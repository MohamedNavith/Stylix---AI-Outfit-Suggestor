import os
import httpx
from database import EncryptedDatabase

def unlink_all_users():
    print("Initializing Database...")
    db = EncryptedDatabase()
    
    if not db.is_cloud:
        print("Stylix is not in Cloud Mode. Resetting local users...")
        for username in list(db.data["users"].keys()):
            user = db.data["users"][username]
            user["mobile"] = ""
            user["telegram_chat_id"] = None
            user["whatsapp_phone_number"] = None
            user["telegram_linked"] = False
            user["whatsapp_linked"] = False
        db.save()
        print("Local reset completed!")
        return

    from database import SUPABASE_URL
    print("Stylix running in CLOUD SYNC Mode. Target:", SUPABASE_URL)
    
    # 1. Fetch all users from Supabase
    try:
        url = f"{SUPABASE_URL}/rest/v1/stylix_users"
        res = httpx.get(url, headers=db.headers)
        if res.status_code != 200:
            print(f"Error fetching users: {res.status_code} - {res.text}")
            return
            
        users = res.json()
        print(f"Found {len(users)} users in Cloud Database.")
        
        # 2. Reset fields for each user
        for user in users:
            username = user.get("username")
            print(f"Unlinking credentials for user '{username}'...")
            
            payload = {
                "mobile": "",
                "telegram_chat_id": None,
                "whatsapp_phone_number": None,
                "telegram_linked": False,
                "whatsapp_linked": False
            }
            
            patch_url = f"{SUPABASE_URL}/rest/v1/stylix_users?username=eq.{username}"
            patch_res = httpx.patch(patch_url, json=payload, headers=db.headers)
            if patch_res.status_code in [200, 204]:
                print(f"Successfully unlinked '{username}'!")
            else:
                print(f"Failed to unlink '{username}': {patch_res.status_code} - {patch_res.text}")
                
        print("Cloud unlinking completed successfully!")
    except Exception as e:
        print(f"Error executing cloud reset: {e}")

if __name__ == "__main__":
    unlink_all_users()
