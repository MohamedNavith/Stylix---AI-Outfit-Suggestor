import datetime
from typing import Dict, List, Any

class ContextAgent:
    def __init__(self):
        pass

    def get_calendar_events(self) -> List[str]:
        """
        Return the 6 occasions to match the user's Figma layout.
        """
        return [
            "OFFICE DAY",
            "CLIENT LUNCH",
            "CASUAL FRIDAY",
            "CASUAL DAY",
            "WEEKEND OUTING",
            "REST DAY"
        ]

    def get_6day_context(self) -> List[Dict[str, Any]]:
        """
        Generate 6 days starting from today with proper date labels and calendar events.
        """
        calendar_events = self.get_calendar_events()
        today = datetime.date.today()
        context_list = []
        
        for i in range(6):
            target_date = today + datetime.timedelta(days=i)
            day_name = target_date.strftime("%a") # "Mon", "Tue"
            date_label = target_date.strftime("%b %d") # "Jul 28"
            
            context_list.append({
                "day_index": i,
                "day_name": day_name,
                "date_label": date_label,
                "occasion": calendar_events[i] if i < len(calendar_events) else "CASUAL DAY"
            })
            
        return context_list
