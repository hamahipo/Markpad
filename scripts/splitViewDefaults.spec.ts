import assert from 'node:assert/strict';

import { onTestFinished, test } from 'vitest';

import { flushSync } from 'svelte';

import {
	DEFAULT_SPLIT_EDITOR_SIDE,
	DEFAULT_SPLIT_SCROLL_SYNC,
	SPLIT_SCROLL_SYNC_DEFAULT_ON_KEY,
} from '../src/lib/utils/splitPanes.ts';

/*
 * This fork's split-view product defaults: preview left / editor right, and a
 * new split starts scroll-locked. The layout swap and the lock already exist;
 * these tests pin the starting answers a fresh install gets.
 *
 * Runs under vitest so `SettingsStore` is the compiler's runes module. The
 * singleton is not used — it may already have been mutated by another spec
 * in this file's isolate — so each test builds its own store and disposes it.
 */
(window as any).__TAURI_INTERNALS__ = {
	metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
	invoke: (cmd: string) => Promise.resolve(cmd === 'get_os_type' ? 'linux' : null),
};

const { SettingsStore } = await import('../src/lib/stores/settings.svelte.js');

function freshStore() {
	localStorage.clear();
	const store = new SettingsStore();
	onTestFinished(() => store.dispose());
	return store;
}

test('a fresh install puts the editor on the right of a split', () => {
	assert.equal(DEFAULT_SPLIT_EDITOR_SIDE, 'right');
	assert.equal(freshStore().splitEditorSide, 'right');
});

test('a fresh install starts a new split scroll-locked', () => {
	assert.equal(DEFAULT_SPLIT_SCROLL_SYNC, true);
	assert.equal(freshStore().splitScrollSync, true);
});

test('a persisted false is rewritten to on at the next SettingsStore boot', () => {
	localStorage.clear();
	localStorage.setItem('editor.splitScrollSync', 'false');
	const store = new SettingsStore();
	onTestFinished(() => store.dispose());
	assert.equal(store.splitScrollSync, true);
	flushSync();
	assert.equal(localStorage.getItem('editor.splitScrollSync'), 'true');
	assert.equal(localStorage.getItem(SPLIT_SCROLL_SYNC_DEFAULT_ON_KEY), '1');
});
