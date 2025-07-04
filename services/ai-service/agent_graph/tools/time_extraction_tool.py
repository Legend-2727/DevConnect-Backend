"""
AI-powered time slot extraction from interviewer emails
"""
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
import json
import re
from datetime import datetime, timedelta

@tool
def extract_time_slots_with_ai(email_content: str) -> dict:
    """
    Use AI to extract available time slots from interviewer's email.
    
    Args:
        email_content: The email body content from interviewer
    
    Returns:
        dict: {
            "time_slots": [
                {
                    "day": "Monday",
                    "date": "2025-06-24", 
                    "time": "2:00 PM - 4:00 PM",
                    "duration_hours": 2
                }
            ]
        }
    """
    try:
        # ✅ ADD DEBUG LOG
        print(f"🔍 Extracting time slots from: '{email_content}'")
        
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.1)
        
        # ✅ IMPROVED PROMPT - More flexible and handles casual formats
        prompt = f"""
You are a time slot extraction specialist. Extract all available interview time slots from this email reply.

Email content: "{email_content}"

IMPORTANT: This email might be casual and informal. Look for ANY mention of dates and times, including:
- "25th june, 10 am" 
- "June 25th at 10am"
- "I'm free Monday 2pm"
- "available tomorrow at 3"
- "next Tuesday 10:00"

Extract time information and return a JSON object with this exact format:
{{
    "time_slots": [
        {{
            "day": "Tuesday",
            "date": "2025-06-25",
            "time": "10:00 AM - 11:00 AM", 
            "duration_hours": 1
        }}
    ]
}}

Rules:
1. Be VERY flexible with date formats - accept "25th june", "june 25", "June 25th", etc.
2. Accept time formats like "10 am", "10am", "10:00 AM", "10 o'clock"
3. If end time not specified, assume 1-hour duration
4. Convert dates to YYYY-MM-DD format (assume 2025 if year not given)
5. If someone says "I'm free at X time", extract that as an available slot
6. Return empty array ONLY if absolutely no time/date information exists

Current date for reference: {datetime.now().strftime('%Y-%m-%d')}

Return ONLY the JSON object, no other text.
"""
        
        response = llm.invoke(prompt)
        print(f"🤖 AI response: {response.content}")
        
        try:
            # Parse AI response
            result = json.loads(response.content)
            
            # Validate and clean up time slots
            cleaned_slots = []
            for slot in result.get("time_slots", []):
                if all(key in slot for key in ["day", "date", "time"]):
                    cleaned_slots.append({
                        "day": slot["day"],
                        "date": slot["date"],
                        "time": slot["time"],
                        "duration_hours": slot.get("duration_hours", 1)
                    })
            
            print(f"✅ AI extracted {len(cleaned_slots)} time slots: {cleaned_slots}")
            
            return {
                "time_slots": cleaned_slots,
                "extraction_success": True
            }
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            print(f"Raw AI response: {response.content}")
            # Fallback: Try regex extraction
            return extract_time_slots_with_regex(email_content)
            
    except Exception as e:
        print(f"❌ AI extraction error: {e}")
        return extract_time_slots_with_regex(email_content)

def extract_time_slots_with_regex(email_content: str) -> dict:
    """Fallback regex-based time extraction"""
    try:
        print(f"🔧 Fallback regex extraction for: '{email_content}'")
        
        # ✅ IMPROVED REGEX PATTERNS - Handle casual formats
        time_patterns = [
            # "25th june, 10 am" or "25th june,10 am" or "june 25th, 10am"
            r'(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?)\s*,?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))',
            
            # "Monday 2pm" or "tuesday at 10am"
            r'(\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b)\s*(?:at)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))',
            
            # "I'm free at 10am" or "available 2:30 PM"
            r'(?:free|available)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))',
            
            # "10:00 AM" or "2 PM" standalone
            r'(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))',
        ]
        
        slots = []
        email_lower = email_content.lower()
        
        for i, pattern in enumerate(time_patterns):
            matches = re.finditer(pattern, email_content, re.IGNORECASE)
            for match in matches:
                print(f"🎯 Pattern {i+1} matched: {match.groups()}")
                
                if len(match.groups()) == 2:
                    # Date + Time pattern
                    date_part, time_part = match.groups()
                    
                    # Convert date to proper format
                    date_str = convert_casual_date_to_iso(date_part)
                    day_name = get_day_name_from_date(date_str)
                    
                    slots.append({
                        "day": day_name,
                        "date": date_str,
                        "time": f"{time_part.strip()} - {calculate_end_time(time_part.strip())}",
                        "duration_hours": 1
                    })
                    
                elif len(match.groups()) == 1:
                    # Time only pattern
                    time_part = match.groups()[0]
                    
                    # Assume next available weekday
                    next_date = get_next_weekday()
                    
                    slots.append({
                        "day": next_date.strftime("%A"),
                        "date": next_date.strftime("%Y-%m-%d"),
                        "time": f"{time_part.strip()} - {calculate_end_time(time_part.strip())}",
                        "duration_hours": 1
                    })
        
        # Remove duplicates
        unique_slots = []
        seen = set()
        for slot in slots:
            slot_key = f"{slot['date']}-{slot['time']}"
            if slot_key not in seen:
                unique_slots.append(slot)
                seen.add(slot_key)
        
        print(f"✅ Regex extracted {len(unique_slots)} unique time slots: {unique_slots}")
        
        return {
            "time_slots": unique_slots[:5],  # Limit to 5 slots
            "extraction_success": len(unique_slots) > 0
        }
        
    except Exception as e:
        print(f"❌ Regex extraction error: {e}")
        return {
            "time_slots": [],
            "extraction_success": False,
            "error": str(e)
        }

def convert_casual_date_to_iso(date_str: str) -> str:
    """Convert casual date formats to ISO format"""
    try:
        date_str = date_str.lower().strip()
        
        # Month mapping
        months = {
            'january': '01', 'jan': '01', 'february': '02', 'feb': '02',
            'march': '03', 'mar': '03', 'april': '04', 'apr': '04',
            'may': '05', 'june': '06', 'jun': '06', 'july': '07', 'jul': '07',
            'august': '08', 'aug': '08', 'september': '09', 'sep': '09',
            'october': '10', 'oct': '10', 'november': '11', 'nov': '11',
            'december': '12', 'dec': '12'
        }
        
        # Extract day and month
        import re
        
        # Pattern: "25th june" or "june 25th"
        if re.search(r'\d+.*?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', date_str):
            # Extract numbers and month names
            day_match = re.search(r'(\d+)', date_str)
            month_match = re.search(r'(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', date_str)
            
            if day_match and month_match:
                day = day_match.group(1).zfill(2)
                month = months[month_match.group(1)]
                year = "2025"  # Assume current/next year
                
                return f"{year}-{month}-{day}"
        
        # Fallback: return tomorrow's date
        tomorrow = datetime.now() + timedelta(days=1)
        return tomorrow.strftime("%Y-%m-%d")
        
    except Exception as e:
        print(f"Date conversion error: {e}")
        tomorrow = datetime.now() + timedelta(days=1)
        return tomorrow.strftime("%Y-%m-%d")

def get_day_name_from_date(date_str: str) -> str:
    """Get day name from ISO date string"""
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        return date_obj.strftime("%A")
    except:
        return "Monday"

def get_next_weekday() -> datetime:
    """Get next weekday date"""
    today = datetime.now()
    days_ahead = 1
    while (today + timedelta(days=days_ahead)).weekday() >= 5:  # Skip weekends
        days_ahead += 1
    return today + timedelta(days=days_ahead)

def calculate_end_time(start_time: str) -> str:
    """Calculate end time (1 hour after start)"""
    try:
        import re
        
        # Extract hour and AM/PM
        time_match = re.search(r'(\d+)(?::(\d+))?\s*(am|pm)', start_time.lower())
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2)) if time_match.group(2) else 0
            period = time_match.group(3)
            
            # Convert to 24-hour format
            if period == 'pm' and hour != 12:
                hour += 12
            elif period == 'am' and hour == 12:
                hour = 0
            
            # Add 1 hour
            end_hour = hour + 1
            end_period = 'AM' if end_hour < 12 else 'PM'
            
            if end_hour > 12:
                end_hour -= 12
            elif end_hour == 0:
                end_hour = 12
            
            end_time_str = f"{end_hour}:{minute:02d} {end_period}"
            return end_time_str
    except:
        pass
    
    return "11:00 AM"  # Default fallback