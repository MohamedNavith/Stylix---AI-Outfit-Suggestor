import os
import json
import base64
from typing import Dict, List, Any, Optional
import httpx
from Crypto.Cipher import AES
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Configuration
DB_FILE = os.path.join(os.path.dirname(__file__), "database.enc")
DEFAULT_KEY = b"RotationN_SecureWardrobeKey_2026"

# Supabase Configurations
try:
    from config_keys import DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY
except ImportError:
    DEFAULT_SUPABASE_URL = ""
    DEFAULT_SUPABASE_KEY = ""

SUPABASE_URL = os.environ.get("SUPABASE_URL") or DEFAULT_SUPABASE_URL
SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_KEY") or DEFAULT_SUPABASE_KEY


def get_encryption_key() -> bytes:
    key_str = os.environ.get("ROTATION_DB_KEY", "")
    if not key_str:
        return DEFAULT_KEY
    key_bytes = key_str.encode("utf-8")
    if len(key_bytes) >= 32:
        return key_bytes[:32]
    return key_bytes + b"0" * (32 - len(key_bytes))

def encrypt_data(data_str: str) -> bytes:
    key = get_encryption_key()
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(data_str.encode("utf-8"))
    payload = {
        "nonce": base64.b64encode(cipher.nonce).decode("utf-8"),
        "tag": base64.b64encode(tag).decode("utf-8"),
        "ciphertext": base64.b64encode(ciphertext).decode("utf-8")
    }
    return json.dumps(payload).encode("utf-8")

def decrypt_data(encrypted_bytes: bytes) -> str:
    payload = json.loads(encrypted_bytes.decode("utf-8"))
    key = get_encryption_key()
    nonce = base64.b64decode(payload["nonce"])
    tag = base64.b64decode(payload["tag"])
    ciphertext = base64.b64decode(payload["ciphertext"])
    
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    decrypted_bytes = cipher.decrypt_and_verify(ciphertext, tag)
    return decrypted_bytes.decode("utf-8")

class EncryptedDatabase:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EncryptedDatabase, cls).__new__(cls)
            cls._instance.is_cloud = bool(SUPABASE_URL and SUPABASE_KEY)
            cls._instance.load()
        return cls._instance

    def load(self):
        if self.is_cloud:
            print(f"Stylix running in CLOUD SYNC Mode. Target: {SUPABASE_URL}")
            self.headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            # Test connectivity
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/stylix_users?limit=1", headers=self.headers, timeout=3.0)
                if res.status_code == 200:
                    print("Supabase connection established successfully.")
                else:
                    print(f"Supabase test connection returned status: {res.status_code}. Details: {res.text}")
                    self.is_cloud = False
            except Exception as e:
                print(f"Supabase connection test failed: {e}. Falling back to local mode.")
                self.is_cloud = False
                
        if not self.is_cloud:
            print("Stylix running in LOCAL Mode.")
            if os.path.exists(DB_FILE):
                try:
                    with open(DB_FILE, "rb") as f:
                        encrypted_content = f.read()
                    decrypted_json = decrypt_data(encrypted_content)
                    self.data = json.loads(decrypted_json)
                    if "users" not in self.data:
                        self.data = self._get_initial_schema()
                        self.save()
                except Exception as e:
                    print(f"Error decrypting local database: {e}. Reinitializing.")
                    self.data = self._get_initial_schema()
                    self.save()
            else:
                self.data = self._get_initial_schema()
                self.save()

    def save(self):
        if self.is_cloud:
            # Cloud saves immediately write-through to Supabase tables, no global save needed
            return
        try:
            data_str = json.dumps(self.data, indent=2)
            encrypted_bytes = encrypt_data(data_str)
            with open(DB_FILE, "wb") as f:
                f.write(encrypted_bytes)
        except Exception as e:
            print(f"Error saving database: {e}")

    def _get_default_user_data(self) -> Dict[str, Any]:
        # Prepopulate with 12 stylish, versatile items
        sample_wardrobe = [
            {"id": "top_01", "name": "Classic White Linen Shirt", "category": "top", "color": "white", "fabric": "linen", "formality": "smart-casual", "pattern": "solid", "style_tag": "minimalist", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "top_02", "name": "Charcoal Crewneck T-Shirt", "category": "top", "color": "charcoal", "fabric": "cotton", "formality": "casual", "pattern": "solid", "style_tag": "streetwear", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "top_03", "name": "Navy Blue Oxford Button-Down", "category": "top", "color": "navy", "fabric": "cotton", "formality": "smart-casual", "pattern": "solid", "style_tag": "classic", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "top_04", "name": "Black Merino Wool Turtleneck", "category": "top", "color": "black", "fabric": "merino wool", "formality": "formal", "pattern": "solid", "style_tag": "refined", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "bottom_01", "name": "Slim-Fit Indigo Selvedge Jeans", "category": "bottom", "color": "indigo", "fabric": "denim", "formality": "casual", "pattern": "solid", "style_tag": "classic", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "bottom_02", "name": "Sand Beige Chinos", "category": "bottom", "color": "beige", "fabric": "cotton twill", "formality": "smart-casual", "pattern": "solid", "style_tag": "minimalist", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "bottom_03", "name": "Charcoal Grey Tailored Trousers", "category": "bottom", "color": "charcoal", "fabric": "wool blend", "formality": "formal", "pattern": "solid", "style_tag": "refined", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "outer_01", "name": "Olive Green Bomber Jacket", "category": "outerwear", "color": "olive", "fabric": "nylon", "formality": "casual", "pattern": "solid", "style_tag": "streetwear", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "outer_02", "name": "Camel Wool Overcoat", "category": "outerwear", "color": "camel", "fabric": "wool", "formality": "formal", "pattern": "solid", "style_tag": "refined", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "foot_01", "name": "White Minimalist Leather Sneakers", "category": "footwear", "color": "white", "fabric": "leather", "formality": "casual", "pattern": "solid", "style_tag": "minimalist", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "foot_02", "name": "Brown Suede Chelsea Boots", "category": "footwear", "color": "brown", "fabric": "suede", "formality": "smart-casual", "pattern": "solid", "style_tag": "streetwear", "is_clean": True, "last_worn_date": None, "image_data": None},
            {"id": "foot_03", "name": "Black Leather Oxford Shoes", "category": "footwear", "color": "black", "fabric": "leather", "formality": "formal", "pattern": "solid", "style_tag": "refined", "is_clean": True, "last_worn_date": None, "image_data": None}
        ]

        default_profile = {
            "preferred_colors": ["white", "black", "navy", "indigo"],
            "avoided_colors": ["yellow"],
            "avoided_styles": ["preppy"],
            "formality_bias": "smart-casual",
            "category_weights": {"top": 1.0, "bottom": 1.0, "outerwear": 1.0, "footwear": 1.0},
            "color_weights": {"white": 1.2, "black": 1.2, "navy": 1.2, "indigo": 1.1, "beige": 1.1, "charcoal": 1.0, "olive": 1.0, "camel": 1.0, "brown": 1.0, "yellow": 0.2},
            "formality_weights": {"casual": 1.0, "smart-casual": 1.3, "formal": 1.0},
            "pattern_weights": {"solid": 1.2, "stripes": 1.0, "checkered": 1.0, "graphic": 0.8}
        }

        # 6 empty days in the Routine Plan
        initial_plan = []
        weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        import datetime
        today = datetime.date.today()
        for i, day in enumerate(weekdays):
            target_date = today + datetime.timedelta(days=i)
            initial_plan.append({
                "day_index": i,
                "day_name": day,
                "date_label": target_date.strftime("%b %d"),
                "occasion": "OFFICE DAY" if i == 0 else "CLIENT LUNCH" if i == 1 else "CASUAL FRIDAY" if i == 4 else "CASUAL DAY",
                "assigned_outfit": None,
                "status": "Empty",
                "rating": None
            })

        return {
            "wardrobe": sample_wardrobe,
            "style_profile": default_profile,
            "routine_plan": initial_plan,
            "history": []
        }

    def _get_initial_schema(self) -> Dict[str, Any]:
        admin_data = self._get_default_user_data()
        admin_data["password"] = "admin123"
        admin_data["role"] = "admin"
        admin_data["name"] = "Administrator"
        admin_data["birthday"] = "2000-01-01"
        admin_data["gender"] = "male"
        return {
            "users": {
                "admin": admin_data
            }
        }

    # Scoped cloud sync helpers using HTTP rest calls
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        if self.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/stylix_users?username=eq.{username}", headers=self.headers)
                if res.status_code == 200 and res.json():
                    return res.json()[0]
            except Exception as e:
                print(f"Error fetching user from Supabase: {e}")
            return None
        return self.data["users"].get(username)

    def get_user_by_telegram_chat_id(self, chat_id: str) -> Optional[Dict[str, Any]]:
        if self.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/stylix_users?telegram_chat_id=eq.{chat_id}", headers=self.headers)
                if res.status_code == 200 and res.json():
                    return res.json()[0]
            except Exception as e:
                print(f"Error fetching user by telegram chat ID: {e}")
            return None
        for username, user in self.data["users"].items():
            if user.get("telegram_chat_id") == chat_id:
                return user
        return None

    def get_user_by_whatsapp_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        if self.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/stylix_users?whatsapp_phone_number=eq.{phone}", headers=self.headers)
                if res.status_code == 200 and res.json():
                    return res.json()[0]
            except Exception as e:
                print(f"Error fetching user by whatsapp phone: {e}")
            return None
        for username, user in self.data["users"].items():
            if user.get("whatsapp_phone_number") == phone:
                return user
        return None


    def create_user(self, username: str, password: str, name: Optional[str] = None, birthday: Optional[str] = None, gender: Optional[str] = None) -> bool:
        if self.is_cloud:
            # Check if user already exists
            if self.get_user(username):
                return False
            try:
                # 1. Create User
                payload = {
                    "username": username,
                    "password": password,
                    "name": name or username,
                    "birthday": birthday or "2000-01-01",
                    "gender": gender or "male",
                    "role": "user",
                    "theme": "classic"
                }
                res = httpx.post(f"{SUPABASE_URL}/rest/v1/stylix_users", json=payload, headers=self.headers)
                if res.status_code not in [200, 201]:
                    return False
                
                # 2. Seed Default Wardrobe
                defaults = self._get_default_user_data()
                for item in defaults["wardrobe"]:
                    item_payload = {**item, "username": username}
                    httpx.post(f"{SUPABASE_URL}/rest/v1/wardrobe_items", json=item_payload, headers=self.headers)
                
                # 3. Seed Default Style Profile
                profile_payload = {**defaults["style_profile"], "username": username}
                httpx.post(f"{SUPABASE_URL}/rest/v1/style_profiles", json=profile_payload, headers=self.headers)
                
                # 4. Seed Default Plans
                for day in defaults["routine_plan"]:
                    day_payload = {
                        "id": f"plan_{username}_{day['day_index']}",
                        "username": username,
                        "day_index": day["day_index"],
                        "day_name": day["day_name"],
                        "date_label": day["date_label"],
                        "occasion": day["occasion"],
                        "assigned_outfit": None,
                        "status": day["status"],
                        "rating": day["rating"]
                    }
                    httpx.post(f"{SUPABASE_URL}/rest/v1/routine_plans", json=day_payload, headers=self.headers)
                return True
            except Exception as e:
                print(f"Error creating user in Supabase: {e}")
                return False
        else:
            if username in self.data["users"]:
                return False
            user_data = self._get_default_user_data()
            user_data["password"] = password
            user_data["name"] = name or username
            user_data["birthday"] = birthday or "2000-01-01"
            user_data["gender"] = gender or "male"
            user_data["role"] = "user"
            self.data["users"][username] = user_data
            self.save()
            return True

    def get_wardrobe(self, username: str, select_cols: str = "*") -> List[Dict[str, Any]]:
        if self.is_cloud:
            try:
                url = f"{SUPABASE_URL}/rest/v1/wardrobe_items?username=eq.{username}&select={select_cols}"
                res = httpx.get(url, headers=self.headers, timeout=30.0)
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                print(f"Error fetching wardrobe: {e}")
            return []
        user = self.get_user(username)
        if not user:
            return []
        if select_cols == "*":
            return user["wardrobe"]
        cols = [c.strip() for c in select_cols.split(",")]
        filtered = []
        for item in user["wardrobe"]:
            filtered.append({k: v for k, v in item.items() if k in cols})
        return filtered

    def add_wardrobe_item(self, username: str, item: Dict[str, Any]) -> str:
        if self.is_cloud:
            try:
                allowed_keys = {
                    "id", "name", "category", "color", "fabric", "formality", "pattern", "style_tag", "is_clean", "last_worn_date", "image_data"
                }
                clean_item = {k: v for k, v in item.items() if k in allowed_keys}
                payload = {**clean_item, "username": username}
                res = httpx.post(f"{SUPABASE_URL}/rest/v1/wardrobe_items", json=payload, headers=self.headers)
                if res.status_code in [200, 201]:
                    return item["id"]
                else:
                    print(f"Error posting wardrobe item to Supabase: {res.status_code} - {res.text}")
            except Exception as e:
                print(f"Error adding wardrobe item: {e}")
            return ""
        user = self.get_user(username)
        if user:
            user["wardrobe"].append(item)
            self.save()
            return item["id"]
        return ""

    def update_wardrobe_item(self, username: str, item_id: str, updates: Dict[str, Any]) -> bool:
        if self.is_cloud:
            try:
                allowed_keys = {
                    "id", "name", "category", "color", "fabric", "formality", "pattern", "style_tag", "is_clean", "last_worn_date", "image_data"
                }
                clean_updates = {k: v for k, v in updates.items() if k in allowed_keys}
                res = httpx.patch(f"{SUPABASE_URL}/rest/v1/wardrobe_items?id=eq.{item_id}&username=eq.{username}", json=clean_updates, headers=self.headers)
                return res.status_code in [200, 204]
            except Exception as e:
                print(f"Error updating wardrobe item: {e}")
                return False
        user = self.get_user(username)
        if user:
            for item in user["wardrobe"]:
                if item["id"] == item_id:
                    item.update(updates)
                    self.save()
                    return True
        return False

    def get_style_profile(self, username: str) -> Dict[str, Any]:
        if self.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/style_profiles?username=eq.{username}", headers=self.headers)
                if res.status_code == 200 and res.json():
                    return res.json()[0]
            except Exception as e:
                print(f"Error fetching style profile: {e}")
            return {}
        user = self.get_user(username)
        return user["style_profile"] if user else {}

    def update_style_profile(self, username: str, updates: Dict[str, Any]):
        if self.is_cloud:
            try:
                # Remove primary key username before patching if present
                clean_updates = {k: v for k, v in updates.items() if k != "username"}
                httpx.patch(f"{SUPABASE_URL}/rest/v1/style_profiles?username=eq.{username}", json=clean_updates, headers=self.headers)
            except Exception as e:
                print(f"Error updating style profile: {e}")
            return
        user = self.get_user(username)
        if user:
            user["style_profile"].update(updates)
            self.save()

    def get_routine_plan(self, username: str) -> List[Dict[str, Any]]:
        raw_plan = []
        if self.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/routine_plans?username=eq.{username}&order=day_index.asc", headers=self.headers)
                if res.status_code == 200:
                    raw_plan = res.json()
            except Exception as e:
                print(f"Error fetching routine plan: {e}")
        else:
            user = self.get_user(username)
            raw_plan = user["routine_plan"] if user else []

        if raw_plan:
            try:
                wardrobe = self.get_wardrobe(username, select_cols="id,image_data")
                image_map = {item["id"]: item.get("image_data") for item in wardrobe if item.get("image_data")}
                for day in raw_plan:
                    if "assigned_outfit" in day and isinstance(day["assigned_outfit"], list):
                        for item in day["assigned_outfit"]:
                            if not item.get("image_data"):
                                item["image_data"] = image_map.get(item["id"])
            except Exception as e:
                print(f"Error enriching plan image data: {e}")

        return raw_plan

    def update_routine_plan(self, username: str, plan: List[Dict[str, Any]]):
        if self.is_cloud:
            try:
                for day in plan:
                    day_id = f"plan_{username}_{day['day_index']}"
                    payload = {
                        "occasion": day["occasion"],
                        "assigned_outfit": day["assigned_outfit"],
                        "status": day["status"],
                        "rating": day["rating"]
                    }
                    httpx.patch(f"{SUPABASE_URL}/rest/v1/routine_plans?id=eq.{day_id}&username=eq.{username}", json=payload, headers=self.headers)
            except Exception as e:
                print(f"Error updating routine plan: {e}")
            return
        user = self.get_user(username)
        if user:
            user["routine_plan"] = plan
            self.save()

    def update_user_settings(self, username: str, updates: Dict[str, Any]) -> bool:
        if self.is_cloud:
            try:
                res = httpx.patch(f"{SUPABASE_URL}/rest/v1/stylix_users?username=eq.{username}", json=updates, headers=self.headers)
                return res.status_code in [200, 204]
            except Exception as e:
                print(f"Error updating user profile settings: {e}")
                return False
        user = self.get_user(username)
        if user:
            user.update(updates)
            self.save()
            return True
        return False

    def log_history(self, username: str, record: Dict[str, Any]):
        if self.is_cloud:
            # We skip heavy logging in test cloud database
            return
        user = self.get_user(username)
        if user:
            user["history"].append(record)
            self.save()

    def get_history(self, username: str) -> List[Dict[str, Any]]:
        return []

    # Chat History Cloud Sync Methods
    def get_chat_history(self, username: str) -> List[Dict[str, Any]]:
        if self.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/chat_history?username=eq.{username}&order=created_at.asc&limit=20", headers=self.headers)
                if res.status_code == 200:
                    return [{"sender": r["sender"], "text": r["text"]} for r in res.json()]
            except Exception as e:
                print(f"Error getting cloud chat history: {e}")
            return []
        # Local mock chat history stored in session only
        return []

    def save_chat_message(self, username: str, sender: str, text: str):
        if self.is_cloud:
            try:
                payload = {
                    "username": username,
                    "sender": sender,
                    "text": text
                }
                httpx.post(f"{SUPABASE_URL}/rest/v1/chat_history", json=payload, headers=self.headers)
            except Exception as e:
                print(f"Error saving cloud chat message: {e}")
