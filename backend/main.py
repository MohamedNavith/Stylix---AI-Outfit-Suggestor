import uuid
import os
import datetime
import base64
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from database import EncryptedDatabase
from agents.coordinator import CoordinatorAgent

app = FastAPI(title="Stylix Multi-User API")
db = EncryptedDatabase()
coordinator = CoordinatorAgent(db)

system_logs = []

def log_system_event(event: str):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    system_logs.insert(0, f"[{timestamp}] {event}")
    if len(system_logs) > 100:
        system_logs.pop()

# Load tokens from environment
try:
    from config_keys import DEFAULT_TELEGRAM_BOT_TOKEN
except ImportError:
    DEFAULT_TELEGRAM_BOT_TOKEN = ""

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or DEFAULT_TELEGRAM_BOT_TOKEN
WHATSAPP_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
WHATSAPP_VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "stylix_verification")

import time
from fastapi.responses import PlainTextResponse

# In-memory failed logins tracker: {key: [timestamps]}
failed_login_attempts = {}

def check_login_rate_limit(key: str):
    now = time.time()
    # Filter attempts in the last 15 minutes (900 seconds)
    attempts = failed_login_attempts.get(key, [])
    attempts = [t for t in attempts if now - t < 900]
    failed_login_attempts[key] = attempts
    
    if len(attempts) >= 5:
        # Calculate cooldown time
        cooldown = int(900 - (now - attempts[0]))
        return False, cooldown
    return True, 0

def record_failed_login(key: str):
    now = time.time()
    if key not in failed_login_attempts:
        failed_login_attempts[key] = []
    failed_login_attempts[key].append(now)


# Authorization Verification Helper
def verify_authorization(request: Request, target_username: Optional[str] = None):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        log_system_event("Unauthorized API request: missing or invalid authorization header.")
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
    token = auth_header.split(" ")[1]
    parts = token.split("_")
    if len(parts) < 3 or parts[0] != "token":
        log_system_event("Unauthorized API request: invalid token structure.")
        raise HTTPException(status_code=401, detail="Invalid token format")
        
    token_username = parts[1]
    user = db.get_user(token_username)
    if not user:
        log_system_event(f"Unauthorized API request: invalid user session for '{token_username}'.")
        raise HTTPException(status_code=401, detail="Invalid session token user")
        
    # Check if target_username matches. If not, allow only if request user is admin
    if target_username and target_username != token_username:
        if user.get("role") != "admin":
            log_system_event(f"Forbidden API request: User '{token_username}' attempted to access '{target_username}' data.")
            raise HTTPException(status_code=403, detail="Access denied. You cannot access other users' data.")
            
    return token_username


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://stylix.vercel.app",
        "https://stylix-ai-outfit-suggestor.vercel.app",
    ],
    allow_origin_regex="https://.*\\.vercel\\.app|http://localhost:\\d+|http://127.0.0.1:\\d+|capacitor://localhost",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' *;"
    )
    return response

@app.get("/robots.txt", response_class=PlainTextResponse)
def get_robots_txt():
    return "User-agent: *\nDisallow: /admin\nDisallow: /api/admin/\n"

@app.get("/")
def read_root():
    return {"status": "Stylix Backend Online", "version": "0.1.0"}


# API Schemas
class LoginSchema(BaseModel):
    username: str
    password: str

class SignupSchema(BaseModel):
    username: str
    password: str
    name: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None

class OnboardingSchema(BaseModel):
    preferred_colors: List[str]
    avoided_colors: List[str]
    avoided_styles: List[str]
    formality_bias: str

class FeedbackSchema(BaseModel):
    day_index: int
    rating: Optional[str] = None

class SwapSchema(BaseModel):
    day_index: int
    item_ids: List[str]

class AddItemSchema(BaseModel):
    name: Optional[str] = None
    image_data: str
    file_name: Optional[str] = None

class AddVideoSchema(BaseModel):
    name: Optional[str] = None
    video_data: str
    file_name: Optional[str] = None

class ChatSchema(BaseModel):
    username: str
    message: str

class SettingsUpdateSchema(BaseModel):
    name: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None
    theme: Optional[str] = None
    whatsapp_linked: Optional[bool] = None
    telegram_linked: Optional[bool] = None

# Authentication Endpoints
@app.post("/api/auth/login")
def login(data: LoginSchema, request: Request):
    ip = request.client.host if request.client else "unknown"
    username = data.username
    
    # Check rate limit per IP
    ip_ok, ip_cooldown = check_login_rate_limit(f"ip:{ip}")
    if not ip_ok:
        log_system_event(f"Rate limit exceeded: Blocked login attempt from IP {ip}.")
        raise HTTPException(
            status_code=429, 
            detail=f"Too many failed login attempts from this IP. Please try again in {ip_cooldown} seconds."
        )
        
    # Check rate limit per Account username
    user_ok, user_cooldown = check_login_rate_limit(f"user:{username}")
    if not user_ok:
        log_system_event(f"Rate limit exceeded: Blocked login attempt for username '{username}'.")
        raise HTTPException(
            status_code=429, 
            detail=f"Too many failed login attempts for this account. Please try again in {user_cooldown} seconds."
        )
        
    user = db.get_user(username)
    if not user:
        record_failed_login(f"ip:{ip}")
        record_failed_login(f"user:{username}")
        log_system_event(f"Failed login attempt: Non-existent user '{username}' from IP {ip}.")
        raise HTTPException(status_code=404, detail="User not found")
        
    if user["password"] != data.password:
        record_failed_login(f"ip:{ip}")
        record_failed_login(f"user:{username}")
        if username == "admin":
            log_system_event(f"ALERT: Failed admin login attempt from IP {ip} (incorrect password)!")
        else:
            log_system_event(f"Failed login attempt for user '{username}' from IP {ip}.")
        raise HTTPException(status_code=401, detail="Incorrect password")
        
    # Clear on success
    failed_login_attempts.pop(f"ip:{ip}", None)
    failed_login_attempts.pop(f"user:{username}", None)
    
    log_system_event(f"User '{username}' successfully logged in.")
    
    return {
        "username": username,
        "name": user.get("name", username),
        "birthday": user.get("birthday", "2000-01-01"),
        "gender": user.get("gender", "male"),
        "role": user.get("role", "user"),
        "email": user.get("email", ""),
        "mobile": user.get("mobile", ""),
        "theme": user.get("theme", "classic"),
        "whatsapp_linked": user.get("whatsapp_linked", False),
        "telegram_linked": user.get("telegram_linked", False),
        "token": f"token_{username}_{uuid.uuid4().hex[:6]}"
    }

@app.post("/api/auth/signup")
def signup(data: SignupSchema):
    if len(data.username) < 3 or len(data.password) < 4:
        raise HTTPException(status_code=400, detail="Username (min 3 chars) and password (min 4 chars) too short.")
    success = db.create_user(
        username=data.username,
        password=data.password,
        name=data.name,
        birthday=data.birthday,
        gender=data.gender
    )
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    log_system_event(f"New user registered: '{data.username}' ({data.gender or 'male'}).")
    
    # Automatically log the user in
    user = db.get_user(data.username)
    if not user:
        raise HTTPException(status_code=404, detail="User created but failed to load database profile.")
        
    return {
        "username": data.username,
        "name": user.get("name", data.username),
        "birthday": user.get("birthday", "2000-01-01"),
        "gender": user.get("gender", "male"),
        "role": user.get("role", "user"),
        "email": user.get("email", ""),
        "mobile": user.get("mobile", ""),
        "theme": user.get("theme", "classic"),
        "whatsapp_linked": user.get("whatsapp_linked", False),
        "telegram_linked": user.get("telegram_linked", False),
        "token": f"token_{data.username}_{uuid.uuid4().hex[:6]}"
    }

# Birthday notification check
@app.get("/api/notifications/birthday")
def check_birthday(username: str, request: Request):
    verify_authorization(request, username)
    user = db.get_user(username)
    if not user or not user.get("birthday"):
        return {"is_birthday": False}
    
    bday_str = user["birthday"]
    try:
        today = datetime.date.today()
        if len(bday_str) == 10:
            parsed = datetime.datetime.strptime(bday_str, "%Y-%m-%d")
        else:
            parsed = datetime.datetime.strptime(bday_str, "%m-%d")
        
        if parsed.month == today.month and parsed.day == today.day:
            return {"is_birthday": True, "message": f"Happy Birthday, {user.get('name', username)}! 🎂 Enjoy your custom recommendations!"}
    except Exception:
        pass
    return {"is_birthday": False}

# Profile Settings Update
@app.post("/api/profile/update")
def update_profile(username: str, data: SettingsUpdateSchema, request: Request):
    verify_authorization(request, username)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No updates specified"}
    success = db.update_user_settings(username, updates)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to update profile settings")
    log_system_event(f"User '{username}' updated profile settings.")
    return {"message": "Profile updated successfully"}

# Wardrobe Endpoints
@app.get("/api/wardrobe")
def get_wardrobe(username: str, request: Request):
    verify_authorization(request, username)
    return coordinator.wardrobe_agent.get_wardrobe(username)

@app.post("/api/wardrobe")
async def add_wardrobe_item(username: str, data: AddItemSchema, request: Request):
    verify_authorization(request, username)
    try:
        tags = coordinator.wardrobe_agent.catalog_clothing_item(data.image_data, data.file_name)
        item_name = data.name if data.name else tags.get("name", "New Wardrobe Item")
        
        new_item = {
            "id": f"item_{uuid.uuid4().hex[:8]}",
            "name": item_name,
            "category": tags.get("category", "top"),
            "color": tags.get("color", "white"),
            "fabric": tags.get("fabric", "cotton"),
            "formality": tags.get("formality", "casual"),
            "pattern": tags.get("pattern", "solid"),
            "style_tag": tags.get("style_tag", "minimalist"),
            "is_clean": True,
            "last_worn_date": None,
            "image_data": data.image_data,
            "mesh_type": tags.get("mesh_type", "shirt"),
            "texture_map": tags.get("texture_map", "solid_color")
        }
        
        db.add_wardrobe_item(username, new_item)
        log_system_event(f"User '{username}' cataloged new clothing: {new_item['name']} ({new_item['color']}).")
        return new_item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/wardrobe/upload-video")
async def upload_video_item(username: str, data: AddVideoSchema, request: Request):
    verify_authorization(request, username)
    try:
        tags = coordinator.wardrobe_agent.process_video_frames_3d(data.video_data, data.file_name)
        item_name = data.name if data.name else tags.get("name", "3D Scanned Outfit")
        
        new_item = {
            "id": f"item_3d_{uuid.uuid4().hex[:8]}",
            "name": item_name,
            "category": tags.get("category", "top"),
            "color": tags.get("color", "gold"),
            "fabric": tags.get("fabric", "silk"),
            "formality": tags.get("formality", "smart-casual"),
            "pattern": tags.get("pattern", "solid"),
            "style_tag": tags.get("style_tag", "refined"),
            "is_clean": True,
            "last_worn_date": None,
            "image_data": None,
            "mesh_type": tags.get("mesh_type", "dress"),
            "texture_map": tags.get("texture_map", "gold_glitter"),
            "is_3d": True
        }
        db.add_wardrobe_item(username, new_item)
        return new_item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/wardrobe/{item_id}")
def delete_wardrobe_item(username: str, item_id: str, request: Request):
    verify_authorization(request, username)
    user = db.get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    wardrobe = user["wardrobe"]
    item_found = False
    for i, item in enumerate(wardrobe):
        if item["id"] == item_id:
            wardrobe.pop(i)
            item_found = True
            break
            
    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db.save()
    log_system_event(f"User '{username}' deleted clothing item ID {item_id}.")
    return {"message": "Item deleted successfully"}

# Profile Endpoints
@app.get("/api/profile")
def get_style_profile(username: str, request: Request):
    verify_authorization(request, username)
    profile = db.get_style_profile(username)
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile

@app.post("/api/profile/onboarding")
def save_onboarding(username: str, data: OnboardingSchema, request: Request):
    verify_authorization(request, username)
    coordinator.stylist_agent.initialize_onboarding(username, data.model_dump())
    log_system_event(f"User '{username}' completed style profile onboarding.")
    return {"message": "Onboarding completed successfully"}

@app.get("/api/admin/stats")
def get_admin_stats(username: str, request: Request):
    verify_authorization(request, username)
    user = db.get_user(username)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized. Admin access only.")
    
    users_list = []
    if db.is_cloud:
        try:
            from database import SUPABASE_URL
            url = f"{SUPABASE_URL}/rest/v1/style_profiles?select=username"
            res = httpx.get(url, headers=db.headers, timeout=20.0)
            if res.status_code == 200:
                user_profiles = res.json()
                for p in user_profiles:
                    u_name = p.get("username")
                    users_list.append({
                        "username": u_name,
                        "name": u_name,
                        "gender": "male",
                        "role": "admin" if u_name == "admin" else "user",
                        "birthday": "2000-01-01",
                        "total_items": 12,
                        "clean_items": 12,
                        "dirty_items": 0,
                        "formality_bias": "smart-casual",
                        "preferred_colors": ["white", "black"]
                    })
        except Exception as e:
            print(f"Error fetching cloud user stats: {e}")
            
    if not users_list:
        users_list = []
        for k, v in db.data.get("users", {}).items():
            wardrobe = v.get("wardrobe", [])
            total_items = len(wardrobe)
            clean_items = len([i for i in wardrobe if i.get("is_clean", True)])
            dirty_items = total_items - clean_items
            profile = v.get("style_profile", {})
            users_list.append({
                "username": k,
                "name": v.get("name") or k,
                "gender": v.get("gender") or "male",
                "role": v.get("role") or "user",
                "birthday": v.get("birthday") or "2000-01-01",
                "total_items": total_items,
                "clean_items": clean_items,
                "dirty_items": dirty_items,
                "formality_bias": profile.get("formality_bias", "casual"),
                "preferred_colors": profile.get("preferred_colors", [])
            })
        
    return {
        "total_users": len(users_list),
        "users": users_list,
        "logs": system_logs
    }

# Planning Endpoints
@app.get("/api/plan")
def get_plan(username: str, request: Request):
    verify_authorization(request, username)
    return db.get_routine_plan(username)

@app.post("/api/plan/generate")
def generate_plan(username: str, request: Request):
    verify_authorization(request, username)
    plan = coordinator.generate_weekly_cycle(username)
    log_system_event(f"User '{username}' shuffled and generated weekly planner plan.")
    return plan

@app.post("/api/plan/confirm")
def confirm_worn(username: str, data: FeedbackSchema, request: Request):
    verify_authorization(request, username)
    success = coordinator.confirm_day_worn(username, data.day_index, data.rating)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to confirm outfit worn")
    log_system_event(f"User '{username}' confirmed wearing outfit on day index {data.day_index}.")
    return {"message": "Outfit confirmed worn. Learning updated and items sent to wash."}

@app.post("/api/plan/skip")
def skip_outfit(username: str, data: FeedbackSchema, request: Request):
    verify_authorization(request, username)
    success = coordinator.skip_day_outfit(username, data.day_index)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to skip outfit")
    log_system_event(f"User '{username}' skipped outfit on day index {data.day_index}.")
    return {"message": "Outfit skipped and style profile updated."}

@app.post("/api/plan/swap")
def swap_outfit(username: str, data: SwapSchema, request: Request):
    verify_authorization(request, username)
    success = coordinator.swap_day_outfit(username, data.day_index, data.item_ids)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to swap outfit")
    log_system_event(f"User '{username}' swapped day index {data.day_index} with custom item IDs: {data.item_ids}.")
    return {"message": "Outfit swapped, new items set to dirty."}

@app.get("/api/plan/suggest-by-occasion")
def suggest_by_occasion(username: str, occasion: str, request: Request):
    verify_authorization(request, username)
    all_items = db.get_wardrobe(username)
    profile = db.get_style_profile(username)
    
    # Filter clean items
    clean_items = [i for i in all_items if i.get("is_clean", True)]
    
    tops = [i for i in clean_items if i.get("category") == "top"]
    bottoms = [i for i in clean_items if i.get("category") == "bottom"]
    footwear = [i for i in clean_items if i.get("category") == "footwear"]
    
    # Fallback to all items if clean ones are missing
    if not tops: tops = [i for i in all_items if i.get("category") == "top"]
    if not bottoms: bottoms = [i for i in all_items if i.get("category") == "bottom"]
    if not footwear: footwear = [i for i in all_items if i.get("category") == "footwear"]
    
    if not tops or not bottoms:
        raise HTTPException(status_code=400, detail="Not enough items in wardrobe to suggest combinations.")
        
    day_context = {"occasion": occasion}
    user_info = db.get_user(username) or {}
    gender = user_info.get("gender", "male").lower()
    
    # Score items using stylist agent
    scored_tops = [(t, coordinator.stylist_agent.score_item(t, day_context, profile)) for t in tops]
    scored_bottoms = [(b, coordinator.stylist_agent.score_item(b, day_context, profile)) for b in bottoms]
    scored_footwear = [(f, coordinator.stylist_agent.score_item(f, day_context, profile)) for f in footwear] if footwear else []
    
    scored_tops.sort(key=lambda x: x[1], reverse=True)
    scored_bottoms.sort(key=lambda x: x[1], reverse=True)
    if scored_footwear:
        scored_footwear.sort(key=lambda x: x[1], reverse=True)
        
    combinations = []
    # Build combinations and score them
    for t_item, t_score in scored_tops[:5]:
        for b_item, b_score in scored_bottoms[:5]:
            if scored_footwear:
                for f_item, f_score in scored_footwear[:5]:
                    combo_score = t_score + b_score + f_score
                    color_score = coordinator.stylist_agent.get_color_harmony_score(t_item.get("color", ""), b_item.get("color", ""))
                    combo_score += color_score
                    
                    if f_item.get("formality") == "formal" and (t_item.get("formality") == "casual" or b_item.get("formality") == "casual"):
                        combo_score -= 1.5
                        
                    if gender == "female" and ("dress" in t_item.get("name", "").lower() or t_item.get("mesh_type") == "dress"):
                        combo_score += 1.0
                        
                    combinations.append({
                        "score": combo_score,
                        "items": [t_item, b_item, f_item]
                    })
            else:
                combo_score = t_score + b_score
                color_score = coordinator.stylist_agent.get_color_harmony_score(t_item.get("color", ""), b_item.get("color", ""))
                combo_score += color_score
                
                if gender == "female" and ("dress" in t_item.get("name", "").lower() or t_item.get("mesh_type") == "dress"):
                    combo_score += 1.0
                    
                combinations.append({
                    "score": combo_score,
                    "items": [t_item, b_item]
                })
                
    combinations.sort(key=lambda x: x["score"], reverse=True)
    
    # Return top 4 unique combinations
    seen_combos = set()
    unique_combos = []
    for c in combinations:
        combo_key = tuple(sorted([item["id"] for item in c["items"]]))
        if combo_key not in seen_combos:
            seen_combos.add(combo_key)
            unique_combos.append(c["items"])
            if len(unique_combos) >= 4:
                break
                
    return unique_combos


# Laundry Endpoints
@app.get("/api/laundry")
def get_laundry(username: str, request: Request):
    verify_authorization(request, username)
    return coordinator.wardrobe_agent.get_laundry_stats(username)

@app.post("/api/laundry/wash")
def run_laundry(username: str, request: Request):
    verify_authorization(request, username)
    cleaned_count = coordinator.wardrobe_agent.clean_all_dirty_items(username)
    log_system_event(f"User '{username}' washed dirty garments. Cleaned {cleaned_count} items.")
    return {"message": f"Laundry cycle complete. Cleaned {cleaned_count} items."}

# Chat history & Assistant Endpoint
@app.get("/api/chat/history")
def get_chat_history(username: str, request: Request):
    verify_authorization(request, username)
    return db.get_chat_history(username)

@app.post("/api/chat")
def chat_endpoint(data: ChatSchema, request: Request):
    verify_authorization(request, data.username)
    log_system_event(f"User '{data.username}' sent message: \"{data.message[:35]}...\"")
    response = coordinator.stylist_agent.chat_with_stylist(data.username, data.message)
    return {"response": response}

# Global pending photos for Telegram
pending_photos = {}

async def download_telegram_file(file_id: str) -> bytes:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        if res.status_code != 200:
            raise Exception(f"Failed to get file details from Telegram: {res.text}")
        file_path = res.json()["result"]["file_path"]
        
        file_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
        res_file = await client.get(file_url)
        if res_file.status_code != 200:
            raise Exception(f"Failed to download file from Telegram: {res_file.text}")
        return res_file.content

def catalog_description_with_groq(description: str, groq_key: str) -> dict:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {groq_key}",
        "Content-Type": "application/json"
    }
    
    prompt = (
        f"Analyze this clothing item description: '{description}'. "
        "Output a strict JSON object with these fields:\n"
        "1. name (a short, formatted description like 'Faded Green Pant')\n"
        "2. category (must be exactly one of: 'top', 'bottom', 'outerwear', 'footwear', 'accessory')\n"
        "3. color (primary color of the item, like 'navy', 'black', 'white', 'beige', 'green', 'yellow', 'red', 'pink', 'teal', 'blue', 'grey')\n"
        "4. fabric (fabric type, like 'denim', 'cotton', 'wool', 'linen', 'polyester', etc.)\n"
        "5. formality (must be exactly one of: 'casual', 'smart-casual', 'formal')\n"
        "6. pattern (like 'solid', 'stripes', 'checkered', 'graphic', 'floral', 'patterned', etc.)\n"
        "7. style_tag (like 'minimalist', 'streetwear', 'classic', 'athletic', 'refined')\n"
        "Keep the JSON values concise and strictly aligned to these values."
    )
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"}
    }
    
    res = httpx.post(url, json=payload, headers=headers, timeout=20.0)
    if res.status_code == 200:
        return json.loads(res.json()["choices"][0]["message"]["content"])
    else:
        # Simple fallback
        category = "top"
        desc_l = description.lower()
        if any(w in desc_l for w in ["pant", "jeans", "chino", "trouser", "skirt"]):
            category = "bottom"
        elif any(w in desc_l for w in ["shoe", "sneaker", "boot"]):
            category = "footwear"
            
        color = "white"
        colors = ["navy", "black", "white", "beige", "green", "yellow", "red", "pink", "teal", "blue", "grey"]
        for c in colors:
            if c in desc_l:
                color = c
                break
                
        return {
            "name": description.title(),
            "category": category,
            "color": color,
            "fabric": "cotton",
            "formality": "casual",
            "pattern": "solid",
            "style_tag": "classic"
        }

async def process_photo_with_description(username: str, chat_id: str, description: str, image_base64: str):
    # Retrieve Groq key
    try:
        from config_keys import DEFAULT_GROQ_API_KEY
    except ImportError:
        DEFAULT_GROQ_API_KEY = ""
    groq_key = os.environ.get("GROQ_API_KEY") or os.environ.get("GROK_API_KEY") or DEFAULT_GROQ_API_KEY
    
    # Extract tags
    try:
        tags = catalog_description_with_groq(description, groq_key)
    except Exception as e:
        print(f"Groq cataloging error: {e}")
        tags = {
            "name": description.title(),
            "category": "top",
            "color": "white",
            "fabric": "cotton",
            "formality": "casual",
            "pattern": "solid",
            "style_tag": "classic"
        }
        
    # Check duplicate
    wardrobe = coordinator.wardrobe_agent.get_wardrobe(username, select_cols="id,name,category,color,fabric,formality,pattern,style_tag")
    duplicate_item = None
    
    new_name = tags.get("name", "").strip().lower()
    for item in wardrobe:
        if item.get("name", "").strip().lower() == new_name:
            duplicate_item = item
            break
            
    if not duplicate_item:
        for item in wardrobe:
            if (item.get("category") == tags.get("category") and
                item.get("color") == tags.get("color") and
                item.get("fabric") == tags.get("fabric") and
                item.get("pattern") == tags.get("pattern") and
                item.get("formality") == tags.get("formality")):
                duplicate_item = item
                break
                
    if duplicate_item:
        reply = (
            f"❌ Duplicate detected!\n\n"
            f"This item already exists in your wardrobe as:\n"
            f"👕 *{duplicate_item.get('name')}*\n"
            f"Color: {duplicate_item.get('color')} | Category: {duplicate_item.get('category')}\n\n"
            f"Upload ignored to prevent duplicate entries."
        )
        await send_telegram_message(chat_id, reply)
        return
        
    # Construct item and save
    new_item = {
        "id": f"item_{uuid.uuid4().hex[:8]}",
        "name": tags.get("name", "New Item"),
        "category": tags.get("category", "top"),
        "color": tags.get("color", "white"),
        "fabric": tags.get("fabric", "cotton"),
        "formality": tags.get("formality", "casual"),
        "pattern": tags.get("pattern", "solid"),
        "style_tag": tags.get("style_tag", "classic"),
        "is_clean": True,
        "last_worn_date": None,
        "image_data": image_base64,
        "mesh_type": "shirt" if tags.get("category") == "top" else "pant" if tags.get("category") == "bottom" else "coat"
    }
    
    db.add_wardrobe_item(username, new_item)
    
    # Refresh weekly plan with the new item included
    try:
        coordinator.generate_weekly_cycle(username)
    except Exception as e:
        print(f"Error shuffling weekly planner: {e}")
        
    reply = (
        f"✅ Garment cataloged successfully!\n\n"
        f"👕 *{new_item['name']}*\n"
        f"• Category: {new_item['category']}\n"
        f"• Color: {new_item['color']}\n"
        f"• Fabric: {new_item['fabric']}\n"
        f"• Formality: {new_item['formality']}\n"
        f"• Pattern: {new_item['pattern']}\n"
        f"• Style: {new_item['style_tag']}\n\n"
        f"Added to your Stylix wardrobe and weekly rotation plan shuffled!"
    )
    await send_telegram_message(chat_id, reply)

# Telegram Webhook Endpoints
@app.post("/api/webhooks/telegram")
async def telegram_webhook(request: Request):
    try:
        data = await request.json()
        if "message" not in data:
            return {"status": "ignored"}
        
        msg = data["message"]
        chat_id = str(msg["chat"]["id"])
        
        # Handle incoming voice messages
        if "voice" in msg:
            voice = msg["voice"]
            file_id = voice["file_id"]
            
            user = db.get_user_by_telegram_chat_id(chat_id)
            if not user:
                await send_telegram_message(chat_id, "Your Telegram is not linked to a Stylix account. Please type: /start <your_username> to connect.")
                return {"status": "unlinked"}
            
            try:
                audio_bytes = await download_telegram_file(file_id)
                if not audio_bytes:
                    await send_telegram_message(chat_id, "⚠️ Failed to download your voice message.")
                    return {"status": "download_failed"}
                
                transcription_text = await transcribe_audio_with_groq(audio_bytes, "voice.ogg")
                if transcription_text:
                    await send_telegram_message(chat_id, f"🎤 You said: \"{transcription_text}\"")
                    
                    username = user["username"]
                    reply_text = coordinator.stylist_agent.chat_with_stylist(username, transcription_text)
                    
                    await send_telegram_voice_message(chat_id, reply_text)
                    return {"status": "voice_ok"}
                else:
                    await send_telegram_message(chat_id, "⚠️ Sorry, I could not transcribe your voice message. Please try speaking clearly.")
                    return {"status": "transcription_failed"}
            except Exception as e:
                print(f"Failed to handle Telegram voice: {e}")
                await send_telegram_message(chat_id, f"Error processing voice message: {e}")
                return {"status": "voice_error"}
        
        # 1. Handle incoming photos
        if "photo" in msg:
            photo_arr = msg["photo"]
            file_id = photo_arr[-1]["file_id"]
            caption = msg.get("caption", "").strip()
            
            user = db.get_user_by_telegram_chat_id(chat_id)
            if not user:
                await send_telegram_message(chat_id, "Your Telegram is not linked to a Stylix account. Please type: /start <your_username> to connect.")
                return {"status": "unlinked"}
            
            try:
                photo_bytes = await download_telegram_file(file_id)
                image_base64 = "data:image/jpeg;base64," + base64.b64encode(photo_bytes).decode("utf-8")
            except Exception as e:
                await send_telegram_message(chat_id, f"Failed to download image from Telegram: {e}")
                return {"status": "download_failed"}
                
            if caption:
                await process_photo_with_description(user["username"], chat_id, caption, image_base64)
            else:
                # Store pending photo
                pending_photos[chat_id] = {
                    "image_base64": image_base64,
                    "timestamp": datetime.datetime.now()
                }
                await send_telegram_message(chat_id, "I've received your photo! 📸 Please reply to this photo/message with a description of the garment (e.g. 'black formal shirt', 'blue denim jeans') so I can catalog it.")
            return {"status": "photo_received"}
            
        # 2. Handle text messages
        text = msg.get("text", "").strip()
        if not text:
            return {"status": "no text"}
            
        # Check start command: "/start username"
        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            if len(parts) > 1:
                target_user = parts[1].strip()
                user = db.get_user(target_user)
                if user:
                    db.update_user_settings(target_user, {
                        "telegram_chat_id": chat_id,
                        "telegram_linked": True
                    })
                    reply_text = f"Welcome {user.get('name', target_user)}! Your Telegram is now linked to Stylix wardrobe assistant."
                else:
                    reply_text = f"Username '{target_user}' not found on Stylix. Please register first!"
            else:
                reply_text = "Welcome to Stylix! Use: /start <your_username> to link your account."
                
            await send_telegram_message(chat_id, reply_text)
            return {"status": "linked"}
            
        # Verify user
        user = db.get_user_by_telegram_chat_id(chat_id)
        if not user:
            reply_text = "Your Telegram is not linked to a Stylix account. Please type: /start <your_username> to connect."
            await send_telegram_message(chat_id, reply_text)
            return {"status": "unlinked"}

        # Handle explicit commands
        if text == "/help":
            reply_text = (
                "👋 Welcome to Stylix! I'm your AI Wardrobe assistant. Here's what you can do:\n\n"
                "🔹 **Commands**:\n"
                "• /recommend - Get personalized daily outfit suggestions\n"
                "• /laundry - Check your current laundry status\n"
                "• /wash - Reset and mark all laundry as clean\n"
                "• /start <username> - Re-link your account\n\n"
                "📸 **Garment Cataloging**: Send me a photo of a garment and reply to it with a brief description (e.g., 'white shirt') to auto-catalog it into your wardrobe!\n\n"
                "🎤 **Voice Assistant**: Send me a voice note asking styling advice (e.g. 'what should I wear today?'), and I will reply with voice!"
            )
            await send_telegram_message(chat_id, reply_text)
            return {"status": "help_sent"}

        elif text == "/recommend":
            try:
                username = user["username"]
                plan = coordinator.generate_weekly_cycle(username)
                reply_text = "✨ **Your Outfits for the Week**:\n\n"
                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                if plan:
                    for i, day_plan in enumerate(plan):
                        day_name = days[i] if i < len(days) else f"Day {i+1}"
                        items = day_plan.get("outfit", [])
                        item_names = [f"• {item.get('name', 'Item')}" for item in items]
                        reply_text += f"📅 **{day_name}**:\n" + "\n".join(item_names) + "\n\n"
                else:
                    reply_text = "I couldn't generate a plan. Make sure you have cataloged clothes in your wardrobe!"
            except Exception as e:
                reply_text = f"Error generating recommendations: {e}"
            await send_telegram_message(chat_id, reply_text)
            return {"status": "recommend_sent"}

        elif text == "/laundry":
            username = user["username"]
            try:
                stats = coordinator.wardrobe_agent.get_laundry_stats(username)
                total = stats.get("total_items", 0)
                dirty = stats.get("dirty_items", 0)
                clean = total - dirty
                reply_text = (
                    "🧺 **Stylix Laundry Hub**:\n\n"
                    f"🟢 Clean items: **{clean}**\n"
                    f"🔴 Dirty items: **{dirty}**\n"
                    f"📊 Total cataloged: **{total}**\n\n"
                    "Use /wash when you do laundry to reset all dirty garments to clean."
                )
            except Exception as e:
                reply_text = f"Error fetching laundry stats: {e}"
            await send_telegram_message(chat_id, reply_text)
            return {"status": "laundry_sent"}

        elif text == "/wash":
            username = user["username"]
            try:
                cleaned_count = coordinator.wardrobe_agent.clean_all_dirty_items(username)
                reply_text = f"🧺 **Laundry Completed!**\n\nReset all **{cleaned_count}** dirty items back to clean status. Your closet is ready for fresh outfit suggestions!"
            except Exception as e:
                reply_text = f"Error running laundry cycle: {e}"
            await send_telegram_message(chat_id, reply_text)
            return {"status": "wash_sent"}
            
        # Check if replying to a photo or if there is a pending photo description
        if chat_id in pending_photos:
            pending = pending_photos.pop(chat_id)
            # Process description
            await process_photo_with_description(user["username"], chat_id, text, pending["image_base64"])
            return {"status": "photo_cataloged"}
            
        # Normal chat with stylist
        username = user["username"]
        reply_text = coordinator.stylist_agent.chat_with_stylist(username, text)
        await send_telegram_message(chat_id, reply_text)
        return {"status": "ok"}
    except Exception as e:
        print(f"Telegram webhook error: {e}")
        return {"status": "error", "detail": str(e)}

async def send_telegram_message(chat_id: str, text: str):
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT_TOKEN is not configured.")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)

async def transcribe_audio_with_groq(audio_bytes: bytes, file_name: str) -> str:
    try:
        from config_keys import DEFAULT_GROQ_API_KEY
    except ImportError:
        DEFAULT_GROQ_API_KEY = ""
    groq_key = os.environ.get("GROQ_API_KEY") or os.environ.get("GROK_API_KEY") or DEFAULT_GROQ_API_KEY
    
    if not groq_key:
        print("Groq API key not configured for voice transcription.")
        return ""
        
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {groq_key}"
    }
    
    files = {
        "file": (file_name, audio_bytes, "audio/ogg"),
        "model": (None, "whisper-large-v3"),
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, files=files, headers=headers, timeout=30.0)
            if res.status_code == 200:
                return res.json().get("text", "").strip()
            else:
                print(f"Groq Whisper transcription error: {res.status_code} - {res.text}")
                return ""
    except Exception as e:
        print(f"Groq Whisper transcription request failed: {e}")
        return ""

async def send_telegram_voice_message(chat_id: str, text: str):
    from gtts import gTTS
    
    # Strip markdown tags for smooth speech
    clean_text = text.replace("**", "").replace("*", "").replace("#", "").replace("_", "").replace("`", "")
    
    # Auto-detect language
    lang = detect_language(clean_text)
    
    temp_file = f"voice_{chat_id}.mp3"
    try:
        tts = gTTS(text=clean_text, lang=lang)
        tts.save(temp_file)
        
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendVoice"
        with open(temp_file, "rb") as f:
            files = {"voice": (f"voice_{chat_id}.mp3", f, "audio/mp3")}
            data = {"chat_id": chat_id, "caption": text}
            async with httpx.AsyncClient() as client:
                res = await client.post(url, data=data, files=files, timeout=30.0)
                if res.status_code != 200:
                    print(f"Telegram sendVoice failed: {res.status_code} - {res.text}")
                    await send_telegram_message(chat_id, text)
    except Exception as e:
        print(f"Failed to generate gTTS speech response: {e}")
        await send_telegram_message(chat_id, text)
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception as e:
                print(f"Could not remove temp file: {e}")

def detect_language(text: str) -> str:
    # Heuristics for Unicode ranges of common languages
    for char in text:
        val = ord(char)
        if 0x0B80 <= val <= 0x0BFF:
            return "ta" # Tamil
        elif 0x0900 <= val <= 0x097F:
            return "hi" # Hindi
        elif 0x0C00 <= val <= 0x0C7F:
            return "te" # Telugu
        elif 0x0D00 <= val <= 0x0D7F:
            return "ml" # Malayalam
        elif 0x0600 <= val <= 0x06FF:
            return "ar" # Arabic
        elif 0x3040 <= val <= 0x30FF or 0x4E00 <= val <= 0x9FFF:
            return "ja" # Japanese
    return "en" # Default to English

# WhatsApp Webhook Endpoints
@app.get("/api/webhooks/whatsapp")
def verify_whatsapp(request: Request):
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/api/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    try:
        data = await request.json()
        entry = data.get("entry", [])
        if not entry:
            return {"status": "ignored"}
            
        changes = entry[0].get("changes", [])
        if not changes:
            return {"status": "ignored"}
            
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        if not messages:
            return {"status": "ignored"}
            
        msg = messages[0]
        phone = msg.get("from")
        text = msg.get("text", {}).get("body", "").strip()
        
        if not text or not phone:
            return {"status": "no text"}
            
        # Check start command: "/start username"
        if text.lower().startswith("/start"):
            parts = text.split(maxsplit=1)
            if len(parts) > 1:
                target_user = parts[1].strip()
                user = db.get_user(target_user)
                if user:
                    db.update_user_settings(target_user, {
                        "whatsapp_phone_number": phone,
                        "whatsapp_linked": True
                    })
                    reply_text = f"Welcome {user.get('name', target_user)}! Your WhatsApp is now linked to Stylix wardrobe assistant."
                else:
                    reply_text = f"Username '{target_user}' not found on Stylix. Please register first!"
            else:
                reply_text = "Welcome to Stylix! Use: /start <your_username> to link your account."
                
            await send_whatsapp_message(phone, reply_text)
            return {"status": "linked"}
            
        # Normal chat
        user = db.get_user_by_whatsapp_phone(phone)
        if user:
            username = user["username"]
            reply_text = coordinator.stylist_agent.chat_with_stylist(username, text)
        else:
            reply_text = "Your WhatsApp is not linked to a Stylix account. Please reply with: /start <your_username> to connect."
            
        await send_whatsapp_message(phone, reply_text)
        return {"status": "ok"}
    except Exception as e:
        print(f"WhatsApp webhook error: {e}")
        return {"status": "error", "detail": str(e)}

async def send_whatsapp_message(phone: str, text: str):
    if not WHATSAPP_TOKEN:
        print("WHATSAPP_TOKEN is not configured.")
        return
    url = "https://graph.facebook.com/v17.0/me/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text}
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code not in [200, 201]:
            print(f"Failed to send WhatsApp message: {res.text}")


# Dev Endpoints
@app.post("/api/dev/reset")
def reset_database(username: str):
    user = db.get_user(username)
    if user:
        defaults = db._get_default_user_data()
        user.update({
            "wardrobe": defaults["wardrobe"],
            "style_profile": defaults["style_profile"],
            "routine_plan": defaults["routine_plan"],
            "history": []
        })
        db.save()
    return {"message": "Database reset to initial sample data"}
