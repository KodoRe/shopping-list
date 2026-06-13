/* Home Kitchen — internationalization (i18n).
 *
 * WHY A HAND-ROLLED LAYER (no framework):
 *   The app is vanilla JS, stdlib-served, offline-first. A 200-line table + a
 *   t() lookup is the boring-correct fit — no build step, no dependency, works
 *   inside the service-worker-cached shell and the TWA APK identically.
 *
 * DESIGN
 *   - STRINGS[lang][key] holds simple strings, with {var} interpolation.
 *   - Hebrew grammar that a flat table can't express (the DUAL form: 1 = יום,
 *     2 = יומיים, 3+ = ימים) lives in dedicated functions (itemCount, dayPhrase,
 *     expiryLabel) so it can be unit-tested. Grammar belongs in code, not strings.
 *   - detectLang(): explicit localStorage choice wins; else derive from the OS
 *     via navigator.language; else English.
 *   - setLang(): persists, flips <html lang/dir>, and asks the app to re-render.
 *
 * RTL: Hebrew sets <html dir="rtl">. CSS uses logical properties so layout
 *   mirrors automatically (see style.css). Direction is a pure function of lang.
 */
'use strict';

const I18n = (() => {
  const KEY = 'hk_lang';
  const SUPPORTED = ['en', 'he'];
  const RTL_LANGS = ['he'];

  const STRINGS = {
    en: {
      // --- tab bar ---
      'tab.list': 'List',
      'tab.recipes': 'Recipes',
      'tab.pantry': 'Pantry',
      'tab.cook': 'Cook',
      // --- headers ---
      'header.list': 'Shopping List',
      'header.recipes': 'Recipes',
      'header.pantry': 'Pantry',
      'header.cook': 'Guided Cooking',
      // --- header action buttons (aria/title) ---
      'action.themeDark': 'Switch to dark mode',
      'action.themeLight': 'Switch to light mode',
      'action.refreshList': 'Refresh shopping list',
      'action.clearChecked': 'Clear checked items',
      'action.newRecipe': 'Create a new recipe',
      'action.refreshRecipes': 'Refresh recipes',
      'action.refreshPantry': 'Refresh pantry',
      'action.lang': 'Switch to Hebrew',
      // --- add bars ---
      'list.addPlaceholder': 'Add item (e.g. 3 apples)…',
      'list.addAria': 'Add item to shopping list',
      'pantry.addPlaceholder': 'Add pantry item…',
      'pantry.addAria': 'Add to pantry',
      // --- category select ---
      'cat.auto': 'Auto',
      'cat.produce': 'Produce',
      'cat.dairy': 'Dairy',
      'cat.meat': 'Meat & Fish',
      'cat.bakery': 'Bakery',
      'cat.frozen': 'Frozen',
      'cat.drinks': 'Drinks',
      'cat.snacks': 'Snacks',
      'cat.pantry': 'Pantry',
      'cat.household': 'Household',
      'cat.personal': 'Personal Care',
      'cat.other': 'Other',
      // --- view toggle ---
      'view.list': 'List',
      'view.byAisle': 'By Aisle',
      // --- empty states ---
      'empty.list': 'Your list is empty',
      'empty.listSub': 'Add items above, or pull ingredients from a saved recipe.',
      'empty.recipes': 'No recipes yet',
      'empty.recipesSub': 'Save a recipe and it will appear here.',
      'empty.pantry': 'Pantry is empty',
      'empty.pantrySub': "Track what you already have at home so it won't be re-added.",
      'empty.cook': 'No recipes to cook',
      'empty.cookSub': 'Save a recipe first, then come back here.',
      // --- meal tags / filters ---
      'meal.all': 'All',
      'meal.breakfast': 'Breakfast',
      'meal.lunch': 'Lunch',
      'meal.dinner': 'Dinner',
      'meal.snack': 'Snack',
      'meal.dessert': 'Dessert',
      'meal.none': '— none —',
      // --- recipe detail / form ---
      'recipe.back': '← Back to recipes',
      'recipe.cancel': '← Cancel',
      'form.newRecipe': 'New Recipe',
      'form.name': 'Name',
      'form.namePlaceholder': 'e.g. Lemon Herb Chicken',
      'form.meal': 'Meal',
      'form.servings': 'Servings',
      'form.time': 'Time',
      'form.timePlaceholder': '25 min',
      'form.ingredients': 'Ingredients',
      'form.addIngredient': '+ Add ingredient',
      'form.ingredientPlaceholder': 'Ingredient',
      'form.qtyPlaceholder': 'qty',
      'form.steps': 'Steps',
      'form.addStep': '+ Add step',
      'form.stepPlaceholder': 'Describe this step…',
      'form.save': 'Save Recipe',
      // --- guided cooking ---
      'cook.prompt': 'Choose a recipe to start cooking:',
      'cook.exit': '← Exit cooking',
      'cook.step': 'Step {n} of {total}',
      'cook.prev': '← Previous',
      'cook.next': 'Next →',
      'cook.finish': 'Finish',
      'cook.done': '🎉 Done!',
      'cook.prevBtn': '← Previous',
      'cook.complete': '🎉 Recipe complete! Enjoy your meal!',
      // --- modal / misc ---
      'modal.close': 'Close',
      'recipe.servings': '{n} servings',
      'recipe.addAll': '🛒 Add Missing to List',
      'recipe.addOne': '+ Add',
      'recipe.added': '✓ Added',
      'recipe.haveIt': 'Have it',
      'recipe.inPantryTag': '✓ pantry',
      'recipe.sectionIngredients': 'Ingredients',
      'recipe.sectionInstructions': 'Instructions',
      'recipe.startCooking': '👨‍🍳 Start Cooking',
      'recipe.sourceDefault': 'Source',
      'nutr.title': 'Nutritional Estimate (total)',
      'nutr.calories': 'Calories',
      'nutr.protein': 'Protein',
      'nutr.carbs': 'Carbs',
      'nutr.fat': 'Fat',
      'swipe.stock': 'Stock',
      'badge.inPantry': 'in pantry',
      'filter.byMeal': 'Filter recipes by meal',
      'aria.newItemName': 'New item name',
      'aria.itemCategory': 'Item category',
      'aria.listViewMode': 'List view mode',
      'aria.newPantryItem': 'New pantry item',
      'aria.mainSections': 'Main sections',
      'misc.item': 'Item',
      'misc.updated': 'updated',
      // --- toasts / confirms ---
      'toast.added': 'Added {name} ✅',
      'toast.movedPantry': '✅ {name} → pantry',
      'toast.restored': 'Restored {name} to the list',
      'toast.cleared': 'Cleared {count} items',
      'toast.addedToPantry': '{name} added to pantry 🏪',
      'toast.recipeSaved': 'Saved “{name}” 🍳',
      'toast.needName': 'Give the recipe a name first',
      'toast.addedMissing': 'Added {count} items (skipped pantry items)',
      'toast.dateOff': 'That date looks off — try again',
      'toast.pickDate': 'Pick a date first',
      'toast.noEstimate': 'Could not estimate — pick a date instead',
      'toast.expiryUpdated': '{name} now {label} ⏳',
      'toast.expiryReset': '{name} reset to estimate — {label} ↺',
      'confirm.removeChecked': 'Remove {count} checked?',
      'action.undo': 'Undo',
      // --- sync dot ---
      'sync.synced': 'Synced',
      'sync.pending': 'Synced — {count} change(s) pending',
      'sync.offline': 'Offline — changes saved on this device',
      // --- aria for dynamic rows ---
      'aria.check': 'Check {name}',
      'aria.uncheck': 'Uncheck {name}',
      'aria.tapRecipes': '{name} — tap to see recipes',
      'aria.qtyFor': 'Quantity for {name}',
      'aria.remove': 'Remove {name}',
      'aria.removePantry': 'Remove {name} from pantry',
      'aria.removeIngredient': 'Remove ingredient',
      'aria.removeStep': 'Remove step',
      'aria.pickExpiry': 'Pick a new expiry date for {name}',
      'aria.pantryRow': '{name} — {label}. Tap to see recipes.',
    },

    he: {
      // --- tab bar ---
      'tab.list': 'רשימה',
      'tab.recipes': 'מתכונים',
      'tab.pantry': 'מזווה',
      'tab.cook': 'בישול',
      // --- headers ---
      'header.list': 'רשימת קניות',
      'header.recipes': 'מתכונים',
      'header.pantry': 'מזווה',
      'header.cook': 'בישול מודרך',
      // --- header action buttons (aria/title) ---
      'action.themeDark': 'מעבר למצב כהה',
      'action.themeLight': 'מעבר למצב בהיר',
      'action.refreshList': 'רענון רשימת הקניות',
      'action.clearChecked': 'ניקוי פריטים מסומנים',
      'action.newRecipe': 'יצירת מתכון חדש',
      'action.refreshRecipes': 'רענון מתכונים',
      'action.refreshPantry': 'רענון המזווה',
      'action.lang': 'מעבר לאנגלית',
      // --- add bars ---
      'list.addPlaceholder': 'הוספת פריט (לדוגמה: 3 תפוחים)…',
      'list.addAria': 'הוספת פריט לרשימת הקניות',
      'pantry.addPlaceholder': 'הוספת פריט למזווה…',
      'pantry.addAria': 'הוספה למזווה',
      // --- category select ---
      'cat.auto': 'אוטומטי',
      'cat.produce': 'פירות וירקות',
      'cat.dairy': 'מוצרי חלב',
      'cat.meat': 'בשר ודגים',
      'cat.bakery': 'מאפים',
      'cat.frozen': 'קפואים',
      'cat.drinks': 'משקאות',
      'cat.snacks': 'חטיפים',
      'cat.pantry': 'מזווה',
      'cat.household': 'משק בית',
      'cat.personal': 'טיפוח אישי',
      'cat.other': 'אחר',
      // --- view toggle ---
      'view.list': 'רשימה',
      'view.byAisle': 'לפי מחלקה',
      // --- empty states ---
      'empty.list': 'הרשימה שלך ריקה',
      'empty.listSub': 'הוסיפו פריטים למעלה, או משכו מצרכים ממתכון שמור.',
      'empty.recipes': 'אין עדיין מתכונים',
      'empty.recipesSub': 'שמרו מתכון והוא יופיע כאן.',
      'empty.pantry': 'המזווה ריק',
      'empty.pantrySub': 'עקבו אחר מה שכבר יש בבית כדי שלא יתווסף שוב.',
      'empty.cook': 'אין מתכונים לבישול',
      'empty.cookSub': 'שמרו מתכון תחילה, ואז חזרו לכאן.',
      // --- meal tags / filters ---
      'meal.all': 'הכל',
      'meal.breakfast': 'ארוחת בוקר',
      'meal.lunch': 'ארוחת צהריים',
      'meal.dinner': 'ארוחת ערב',
      'meal.snack': 'חטיף',
      'meal.dessert': 'קינוח',
      'meal.none': '— ללא —',
      // --- recipe detail / form ---
      'recipe.back': 'חזרה למתכונים →',
      'recipe.cancel': 'ביטול →',
      'form.newRecipe': 'מתכון חדש',
      'form.name': 'שם',
      'form.namePlaceholder': 'לדוגמה: עוף בלימון ועשבי תיבול',
      'form.meal': 'ארוחה',
      'form.servings': 'מנות',
      'form.time': 'זמן',
      'form.timePlaceholder': '25 דק׳',
      'form.ingredients': 'מצרכים',
      'form.addIngredient': '+ הוספת מצרך',
      'form.ingredientPlaceholder': 'מצרך',
      'form.qtyPlaceholder': 'כמות',
      'form.steps': 'שלבים',
      'form.addStep': '+ הוספת שלב',
      'form.stepPlaceholder': 'תיאור השלב…',
      'form.save': 'שמירת מתכון',
      // --- guided cooking ---
      'cook.prompt': 'בחרו מתכון כדי להתחיל לבשל:',
      'cook.exit': 'יציאה מהבישול →',
      'cook.step': 'שלב {n} מתוך {total}',
      'cook.prev': 'הקודם →',
      'cook.next': '← הבא',
      'cook.finish': 'סיום',
      'cook.done': '🎉 סיימת!',
      'cook.prevBtn': 'הקודם →',
      'cook.complete': '🎉 המתכון הושלם! בתיאבון!',
      // --- modal / misc ---
      'modal.close': 'סגירה',
      'recipe.servings': '{n} מנות',
      'recipe.addAll': '🛒 הוספת חוסרים לרשימה',
      'recipe.addOne': '+ הוספה',
      'recipe.added': '✓ נוסף',
      'recipe.haveIt': 'יש לי',
      'recipe.inPantryTag': '✓ במזווה',
      'recipe.sectionIngredients': 'מצרכים',
      'recipe.sectionInstructions': 'הוראות הכנה',
      'recipe.startCooking': '👨‍🍳 התחלת בישול',
      'recipe.sourceDefault': 'מקור',
      'nutr.title': 'הערכה תזונתית (סה״כ)',
      'nutr.calories': 'קלוריות',
      'nutr.protein': 'חלבון',
      'nutr.carbs': 'פחמימות',
      'nutr.fat': 'שומן',
      'swipe.stock': 'למזווה',
      'badge.inPantry': 'במזווה',
      'filter.byMeal': 'סינון מתכונים לפי ארוחה',
      'aria.newItemName': 'שם פריט חדש',
      'aria.itemCategory': 'קטגוריית פריט',
      'aria.listViewMode': 'מצב תצוגת רשימה',
      'aria.newPantryItem': 'פריט מזווה חדש',
      'aria.mainSections': 'מקטעים ראשיים',
      'misc.item': 'פריט',
      'misc.updated': 'עודכן',
      // --- toasts / confirms ---
      'toast.added': '{name} נוסף ✅',
      'toast.movedPantry': '✅ {name} ← מזווה',
      'toast.restored': '{name} הוחזר לרשימה',
      'toast.cleared': '{count} פריטים נוקו',
      'toast.addedToPantry': '{name} נוסף למזווה 🏪',
      'toast.recipeSaved': '„{name}” נשמר 🍳',
      'toast.needName': 'תנו תחילה שם למתכון',
      'toast.addedMissing': '{count} פריטים נוספו (פריטי מזווה דולגו)',
      'toast.dateOff': 'התאריך נראה שגוי — נסו שוב',
      'toast.pickDate': 'בחרו תאריך תחילה',
      'toast.noEstimate': 'לא ניתן להעריך — בחרו תאריך במקום',
      'toast.expiryUpdated': '{name} כעת {label} ⏳',
      'toast.expiryReset': '{name} אופס להערכה — {label} ↺',
      'confirm.removeChecked': 'להסיר {count} מסומנים?',
      'action.undo': 'ביטול',
      // --- sync dot ---
      'sync.synced': 'מסונכרן',
      'sync.pending': 'מסונכרן — {count} שינויים ממתינים',
      'sync.offline': 'במצב לא מקוון — השינויים נשמרים במכשיר זה',
      // --- aria for dynamic rows ---
      'aria.check': 'סימון {name}',
      'aria.uncheck': 'ביטול סימון {name}',
      'aria.tapRecipes': '{name} — הקישו לצפייה במתכונים',
      'aria.qtyFor': 'כמות עבור {name}',
      'aria.remove': 'הסרת {name}',
      'aria.removePantry': 'הסרת {name} מהמזווה',
      'aria.removeIngredient': 'הסרת מצרך',
      'aria.removeStep': 'הסרת שלב',
      'aria.pickExpiry': 'בחירת תאריך תפוגה חדש עבור {name}',
      'aria.pantryRow': '{name} — {label}. הקישו לצפייה במתכונים.',
    },
  };

  let _lang = 'en';

  // ---- detection ----
  function detectLang() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) { /* private mode */ }
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.startsWith('he') || nav.startsWith('iw') ? 'he' : 'en'; // iw = legacy Hebrew code
  }

  function getLang() { return _lang; }
  function isRtl(lang) { return RTL_LANGS.includes(lang || _lang); }
  function dir(lang) { return isRtl(lang) ? 'rtl' : 'ltr'; }

  // ---- core lookup with {var} interpolation ----
  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  function t(key, vars) {
    const table = STRINGS[_lang] || STRINGS.en;
    const raw = (key in table) ? table[key]
              : (key in STRINGS.en ? STRINGS.en[key] : key); // fall back en, then key itself
    return interpolate(raw, vars);
  }

  // ---- Hebrew-aware grammar helpers (kept in code, unit-tested) ----

  // Noun phrase for a count of days. Hebrew has a DUAL: 1=יום, 2=יומיים, 3+=N ימים.
  function dayPhrase(n) {
    n = Math.abs(n);
    if (_lang === 'he') {
      if (n === 1) return 'יום';
      if (n === 2) return 'יומיים';
      return `${n} ימים`;
    }
    return n === 1 ? '1 day' : `${n} days`;
  }

  // "{n} items" count, with correct singular/plural per language.
  function itemCount(n) {
    if (_lang === 'he') {
      if (n === 1) return 'פריט אחד';
      return `${n} פריטים`;
    }
    return `${n} item${n !== 1 ? 's' : ''}`;
  }

  // Full count line including the "(k done)" suffix used on the list meta.
  function itemCountWithDone(uncheckedN, doneN) {
    const base = itemCount(uncheckedN);
    if (doneN <= 0) return base;
    if (_lang === 'he') return `${base} (${doneN} בוצעו)`;
    return `${base} (${doneN} done)`;
  }

  // Expiry status label for a signed day-delta (negative = past). Mirrors the
  // old expiryStatus() English, now language-aware with the dual form.
  function expiryLabel(d) {
    if (d === null || d === undefined) return '';
    if (_lang === 'he') {
      if (d < 0) return d === -1 ? 'פג אתמול' : `פג לפני ${dayPhrase(d)}`;
      if (d === 0) return 'פג היום';
      if (d === 1) return 'פג מחר';
      return `פג בעוד ${dayPhrase(d)}`;
    }
    if (d < 0) return d === -1 ? 'expired yesterday' : `expired ${dayPhrase(d)} ago`;
    if (d === 0) return 'expires today';
    if (d === 1) return 'expires tomorrow';
    return `expires in ${dayPhrase(d)}`;
  }

  // ---- mutation: set language, persist, flip document, notify app ----
  let _onChange = null;
  function onChange(fn) { _onChange = fn; }

  function applyDocument() {
    if (typeof document === 'undefined') return; // no-op outside the browser (tests)
    const el = document.documentElement;
    el.setAttribute('lang', _lang);
    el.setAttribute('dir', dir());
  }

  function setLang(lang, { persist = true, rerender = true } = {}) {
    if (!SUPPORTED.includes(lang)) return;
    _lang = lang;
    if (persist) { try { localStorage.setItem(KEY, lang); } catch (e) {} }
    applyDocument();
    if (rerender && typeof _onChange === 'function') _onChange(lang);
  }

  function toggle() { setLang(_lang === 'he' ? 'en' : 'he'); }

  // ---- init: detect + apply <html lang/dir> as early as possible ----
  function init() {
    _lang = detectLang();
    applyDocument();
    return _lang;
  }

  return {
    init, t, setLang, getLang, toggle, onChange,
    detectLang, isRtl, dir,
    dayPhrase, itemCount, itemCountWithDone, expiryLabel,
    SUPPORTED, _STRINGS: STRINGS, // _STRINGS exposed for the test harness only
  };
})();

// Node/CommonJS export for the test harness; harmless in the browser.
if (typeof module !== 'undefined' && module.exports) module.exports = I18n;
