# Global menu library

Open **Global Menu Library** in the manager or platform dashboard, or visit `/admin/library` after signing in. The current library contains all 70 Urban Café items, including studio photos and price options.

- Search or filter by category. Select individual items or **Select shown** for a whole category/menu.
- Choose the destination café, then **Review & add**. Desktop users can also drag a card's grip handle into the destination panel; dragging a selected card carries the selection.
- Keep the library categories (missing categories are created), or choose an existing destination category.
- Copies start hidden. Check **Show these items on the customer menu immediately** to publish them during import.
- For different currencies, explicitly acknowledge copying the price numbers into the destination currency. There is no automatic exchange-rate conversion.
- Matching names within the same destination category are skipped. Existing items are never overwritten.
- Use **Save to library** in the menu editor/dashboard to save or refresh a café's entire menu. The library's destination panel also has an expandable save control.

Each imported item and photo belongs to the destination café. Editing its name, price options, photo, availability, discount or special date does not change the source café or saved template. Discounts, specials and visibility are not inherited. Templates survive deletion of their original menu items. Removing a template from the library leaves existing café copies intact; saving the source menu again restores it.

Managers can import only into their own café and remove only their own templates. The platform manager can select any café. The library requires authentication and is not exposed on the customer menu.

The database migration is `migrations/0001_certain_lionheart.sql`. It runs on normal application startup. Include the entire `data/database` and `data/uploads` folders when backing up the application; the café JSON export contains a café's menu only.

Validation: `npm run check`, `npm run build`, and `npm test`. Library publishing, import permissions, independent copies, modifier groups, and media ownership are covered by the Node test scripts without creating QA records in live cafés.
