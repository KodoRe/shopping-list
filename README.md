# Shopping List App

Interactive shared shopping list with Telegram bot integration.

## Features
- Add/remove items with auto-categorization
- Toggle items as you shop (walk through aisles)
- Category view groups items by aisle section
- Watson manages the list via Telegram chat commands
- Syncs between web app and Telegram commands

## How It Works

### Web App
- Open the app on your phone
- Add items manually or let Watson add them
- Toggle items off as you pick them up
- "By Aisle" view groups items by category for efficient shopping

### Telegram Integration
- Add Watson to a group chat
- Commands: "add milk", "remove eggs", "show list", "clear done"
- Watson auto-categorizes items (milk → Dairy, bread → Bakery, etc.)
- Both the web app and Telegram stay in sync

## Tech
- Pure HTML/CSS/JS
- localStorage for offline use
- JSON file sync for Watson integration
- GitHub Pages hosting

## Sync Strategy
- Watson updates `shopping-list.json` when items are added/removed via chat
- Web app polls the JSON file every 30 seconds
- Local changes persist in localStorage
- Merge strategy: additive (new items from Watson get added, no duplicates)
