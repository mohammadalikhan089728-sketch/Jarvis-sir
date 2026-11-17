import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Security Rules Structural & Dirty-Dozen Policy Audit
 * Verifies that firestore.rules enforces all Phase 0 invariants from security_spec.md.
 */
const rules = fs.readFileSync('firestore.rules', 'utf8');

const requiredAssertions: Array<{ name: string; check: () => void }> = [
  {
    name: 'Global safety-net deny rule exists',
    check: () => assert.match(rules, /match \/\s*\{document=\*\*\}\s*\{\s*allow read, write: if false;/),
  },
  {
    name: 'Requires verified email on authenticated owner checks',
    check: () => assert.match(rules, /request\.auth\.token\.email_verified == true/),
  },
  {
    name: 'Path variable hardening isValidId enforces bounded regex',
    check: () => assert.match(rules, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/),
  },
  {
    name: 'List queries enforce resource.data.userId == request.auth.uid',
    check: () => {
      const listMatches = rules.match(/allow list:[^\n]+/g) || [];
      assert.ok(listMatches.length >= 4, 'Expected at least 4 subcollection allow list rules');
      for (const line of listMatches) {
        assert.match(line, /resource\.data\.userId == request\.auth\.uid/);
      }
    },
  },
  {
    name: 'Terminal state locking on tasks prevents mutating completed/cancelled tasks',
    check: () => {
      assert.match(rules, /existing\(\)\.status != 'completed'/);
      assert.match(rules, /existing\(\)\.status != 'cancelled'/);
    },
  },
  {
    name: 'Temporal integrity binds createdAt and updatedAt to request.time',
    check: () => {
      assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
      assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
    },
  },
];

for (const item of requiredAssertions) {
  item.check();
  console.log(`PASS: ${item.name}`);
}
