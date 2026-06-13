#!/usr/bin/env node
/* Unit tests for js/i18n.js — run: node js/test-i18n.js
 *
 * Focus: the grammar that a flat string table CANNOT express, and is therefore
 * the most likely to be subtly wrong:
 *   - English singular/plural ("1 item" vs "5 items")
 *   - Hebrew DUAL form for days (1=יום, 2=יומיים, 3+=N ימים) — the hard case
 *   - {var} interpolation
 *   - fallback chain (missing he key → en → key itself)
 */
'use strict';
const I18n = require('./i18n.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) { pass++; return; }
  fail++;
  console.log(`FAIL: ${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
}

// --- English ---
I18n.setLang('en', { persist: false, rerender: false });
eq('en lookup',          I18n.t('form.addIngredient'), '+ Add ingredient');
eq('en interp name',     I18n.t('toast.added', { name: 'Milk' }), 'Added Milk ✅');
eq('en interp count',    I18n.t('confirm.removeChecked', { count: 3 }), 'Remove 3 checked?');
eq('en itemCount 0',     I18n.itemCount(0), '0 items');
eq('en itemCount 1',     I18n.itemCount(1), '1 item');
eq('en itemCount 5',     I18n.itemCount(5), '5 items');
eq('en done suffix',     I18n.itemCountWithDone(2, 3), '2 items (3 done)');
eq('en done none',       I18n.itemCountWithDone(2, 0), '2 items');
eq('en day 1',           I18n.dayPhrase(1), '1 day');
eq('en day 2',           I18n.dayPhrase(2), '2 days');
eq('en expired -1',      I18n.expiryLabel(-1), 'expired yesterday');
eq('en expired -3',      I18n.expiryLabel(-3), 'expired 3 days ago');
eq('en today',           I18n.expiryLabel(0), 'expires today');
eq('en tomorrow',        I18n.expiryLabel(1), 'expires tomorrow');
eq('en in 8',            I18n.expiryLabel(8), 'expires in 8 days');

// --- Hebrew (dual form is the headline risk) ---
I18n.setLang('he', { persist: false, rerender: false });
eq('he lookup',          I18n.t('form.addIngredient'), '+ הוספת מצרך');
eq('he interp name',     I18n.t('toast.added', { name: 'חלב' }), 'חלב נוסף ✅');
eq('he itemCount 1',     I18n.itemCount(1), 'פריט אחד');
eq('he itemCount 5',     I18n.itemCount(5), '5 פריטים');
eq('he day 1',           I18n.dayPhrase(1), 'יום');
eq('he day 2 (dual)',    I18n.dayPhrase(2), 'יומיים');
eq('he day 3',           I18n.dayPhrase(3), '3 ימים');
eq('he expired -1',      I18n.expiryLabel(-1), 'פג אתמול');
eq('he expired -2 dual', I18n.expiryLabel(-2), 'פג לפני יומיים');
eq('he expired -5',      I18n.expiryLabel(-5), 'פג לפני 5 ימים');
eq('he today',           I18n.expiryLabel(0), 'פג היום');
eq('he tomorrow',        I18n.expiryLabel(1), 'פג מחר');
eq('he in 2 dual',       I18n.expiryLabel(2), 'פג בעוד יומיים');
eq('he in 8',            I18n.expiryLabel(8), 'פג בעוד 8 ימים');
eq('he dir is rtl',      I18n.dir(), 'rtl');

// --- fallback chain ---
eq('he key present',     I18n.t('modal.close'), 'סגירה');
eq('unknown key→itself', I18n.t('nope.nope'), 'nope.nope');

// --- table completeness: every en key must exist in he (no English leaks) ---
const enKeys = Object.keys(I18n._STRINGS.en);
const heKeys = new Set(Object.keys(I18n._STRINGS.he));
const missing = enKeys.filter((k) => !heKeys.has(k));
eq('he covers all en keys', missing.length === 0 ? 'complete' : missing.join(','), 'complete');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
