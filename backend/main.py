import uuid
import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from database import EncryptedDatabase
from agents.coordinator import CoordinatorAgent
from agents.cataloging import catalog_clothing_item
from agents.chatbot import chat_with_stylist

app = FastAPI(title="Stylix Multi-User API")
db = EncryptedDatabase()
coordinator = CoordinatorAgent(db)

# Load tokens from environment
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
WHATSAPP_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
WHATSAPP_VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "stylix_verification")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Schemas
class LoginSchema(BaseModel):
    username: str
    password: str

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

class ChatSchema(BaseModel):
    username: str
    message: str

class SettingsUpdateSchema(BaseModel):
    email: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None
    theme: Optional[str] = None
    whatsapp_linked: Optional[bool] = None
    telegram_linked: Optional[bool] = None

# Authentication Endpoints
@app.post("/api/auth/login")
def login(data: LoginSchema):
    user = db.get_user(data.username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    return {
        "username": data.username,
        "role": user.get("role", "user"),
        "email": user.get("email", ""),
        "mobile": user.get("mobile", ""),
        "theme": user.get("theme", "classic"),
        "whatsapp_linked": user.get("whatsapp_linked", False),
        "telegram_linked": user.get("telegram_linked", False),
        "token": f"token_{data.username}_{uuid.uuid4().hex[:6]}"
    }

@app.post("/api/auth/signup")
def signup(data: LoginSchema):
    if len(data.username) < 3 or len(data.password) < 4:
        raise HTTPException(status_code=400, detail="Username (min 3 chars) and password (min 4 chars) too short.")
    success = db.create_user(data.username, data.password)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": "Account created successfully"}

# Profile Settings Update
@app.post("/api/profile/update")
def update_profile(username: str, data: SettingsUpdateSchema):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No updates specified"}
    success = db.update_user_settings(username, updates)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to update profile settings")
    return {"message": "Profile updated successfully"}

# Wardrobe Endpoints
@app.get("/api/wardrobe")
def get_wardrobe(username: str):
    return db.get_wardrobe(username)

@app.post("/api/wardrobe")
async def add_wardrobe_item(username: str, data: AddItemSchema):
    try:
        tags = catalog_clothing_item(data.image_data, data.file_name)
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
            "image_data": data.image_data
        }
        
        db.add_wardrobe_item(username, new_item)
        return new_item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/wardrobe/{item_id}")
def delete_wardrobe_item(username: str, item_id: str):
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
    return {"message": "Item deleted successfully"}

# Profile Endpoints
@app.get("/api/profile")
def get_style_profile(username: str):
    profile = db.get_style_profile(username)
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile

@app.post("/api/profile/onboarding")
def save_onboarding(username: str, data: OnboardingSchema):
    coordinator.profile_agent.initialize_onboarding(username, data.model_dump())
    return {"message": "Onboarding completed successfully"}

# Planning Endpoints
@app.get("/api/plan")
def get_plan(username: str):
    return db.get_routine_plan(username)

@app.post("/api/plan/generate")
def generate_plan(username: str):
    plan = coordinator.generate_weekly_cycle(username)
    return plan

@app.post("/api/plan/confirm")
def confirm_worn(username: str, data: FeedbackSchema):
    success = coordinator.confirm_day_worn(username, data.day_index, data.rating)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to confirm outfit worn")
    return {"message": "Outfit confirmed worn. Learning updated and items sent to wash."}

@app.post("/api/plan/skip")
def skip_outfit(username: str, data: FeedbackSchema):
    success = coordinator.skip_day_outfit(username, data.day_index)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to skip outfit")
    return {"message": "Outfit skipped and style profile updated."}

@app.post("/api/plan/swap")
def swap_outfit(username: str, data: SwapSchema):
    success = coordinator.swap_day_outfit(username, data.day_index, data.item_ids)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to swap outfit")
    return {"message": "Outfit swapped, new items set to dirty."}

# Laundry Endpoints
@app.get("/api/laundry")
def get_laundry(username: str):
    return coordinator.laundry_agent.get_laundry_stats(username)

@app.post("/api/laundry/wash")
def run_laundry(username: str):
    cleaned_count = coordinator.laundry_agent.clean_all_dirty_items(username)
    return {"message": f"Laundry cycle complete. Cleaned {cleaned_count} items."}

# Chat history & Assistant Endpoint
@app.get("/api/chat/history")
def get_chat_history(username: str):
    return db.get_chat_history(username)

@app.post("/api/chat")
def chat_endpoint(data: ChatSchema):
    response = chat_with_stylist(data.username, data.message)
    return {"response": response}

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

# ==========================================
#  MESSAGING CHANNELS WEBHOOKS (REAL TIME)
# ==========================================

@app.post("/api/webhooks/telegram")
async def telegram_webhook(request: Request):
    """
    Handles incoming messages from the linked Telegram bot.
    Laying out a custom '/start <username>' protocol to link telegram.
    """
    try:
        body = await request.json()
        message = body.get("message", {})
        chat_id = message.get("chat", {}).get("id")
        text = message.get("text", "").strip()
        
        if not chat_id or not text:
            return {"status": "ignored"}
            
        # 1. Check for Telegram linking protocol
        if text.startswith("/start"):
            parts = text.split()
            if len(parts) > 1:
                target_user = parts[1]
                user_found = db.get_user(target_user)
                if user_found:
                    db.update_user_settings(target_user, {
                        "telegram_linked": True,
                        "telegram_chat_id": str(chat_id)
                    })
                    reply_text = f"Stylix successfully linked to @{target_user}! Ask me anything about your wardrobe clean list or suggestions here."
                else:
                    reply_text = f"Username '{target_user}' not found in Stylix database."
            else:
                reply_text = "Welcome to Stylix AI! To link your account, use: /start <your_username>"
                
            await send_telegram_message(chat_id, reply_text)
            return {"status": "ok"}
            
        # 2. General Query: Find user by telegram_chat_id
        target_user = None
        if db.is_cloud:
            # Search in Supabase for user matching telegram_chat_id
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/stylix_users?telegram_chat_id=eq.{chat_id}", headers=db.headers)
                if res.status_code == 200 and res.json():
                    target_user = res.json()[0]["username"]
            except Exception as e:
                print(f"Error querying telegram user: {e}")
        else:
            # Local search
            for username, data in db.data["users"].items():
                if data.get("telegram_chat_id") == str(chat_id):
                    target_user = username
                    break
                    
        if target_user:
            reply_text = chat_with_stylist(target_user, text)
        else:
            reply_text = "Your Telegram account is not linked to Stylix yet. Please log into the app, go to Settings, copy your linking command: /start <username>"
            
        await send_telegram_message(chat_id, reply_text)
        return {"status": "ok"}
    except Exception as e:
        print(f"Telegram webhook error: {e}")
        return {"status": "error", "detail": str(e)}

async def send_telegram_message(chat_id: int, text: str):
    if not TELEGRAM_BOT_TOKEN:
        print(f"Mock Telegram Send (Token Missing) to Chat ID {chat_id}: {text}")
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        async with httpx.AsyncClient() as client:
            await client.post(url, json={"chat_id": chat_id, "text": text}, timeout=5.0)
    except Exception as e:
        print(f"Error calling Telegram sendMessage API: {e}")

@app.get("/api/webhooks/whatsapp")
def verify_whatsapp(request: Request):
    """
    WhatsApp webhook verification check (GET request).
    """
    verify_token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if verify_token == WHATSAPP_VERIFY_TOKEN:
        return int(challenge)
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@app.post("/api/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    Handles incoming messages from WhatsApp Cloud API.
    """
    try:
        body = await request.json()
        entry = body.get("entry", [])
        if not entry:
            return {"status": "ignored"}
            
        changes = entry[0].get("changes", [])
        if not changes:
            return {"status": "ignored"}
            
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        if not messages:
            return {"status": "ignored"}
            
        phone_number = messages[0].get("from") # E.164 phone string
        text = messages[0].get("text", {}).get("body", "").strip()
        metadata = value.get("metadata", {})
        phone_number_id = metadata.get("phone_number_id")
        
        if not phone_number or not text:
            return {"status": "ignored"}
            
        # Find user matching this phone number (checking mobile field)
        target_user = None
        if db.is_cloud:
            try:
                res = httpx.get(f"{SUPABASE_URL}/rest/v1/stylix_users?mobile=eq.{phone_number}", headers=db.headers)
                if res.status_code == 200 and res.json():
                    target_user = res.json()[0]["username"]
            except Exception as e:
                print(f"Error querying WhatsApp user: {e}")
        else:
            for username, data in db.data["users"].items():
                if data.get("mobile") == phone_number:
                    target_user = username
                    break
                    
        if target_user:
            reply_text = chat_with_stylist(target_user, text)
        else:
            reply_text = f"Your WhatsApp number {phone_number} is not linked to any Stylix account. Please log in on PC or Mobile and add this number to your profile."
            
        await send_whatsapp_message(phone_number_id, phone_number, reply_text)
        return {"status": "ok"}
    except Exception as e:
        print(f"WhatsApp webhook error: {e}")
        return {"status": "error", "detail": str(e)}

async def send_whatsapp_message(phone_id: str, to_number: str, text: str):
    if not WHATSAPP_TOKEN or not phone_id:
        print(f"Mock WhatsApp Send (Token Missing) to {to_number}: {text}")
        return
    try:
        url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {WHATSAPP_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": text}
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, headers=headers, timeout=5.0)
    except Exception as e:
        print(f"Error sending WhatsApp message: {e}")
