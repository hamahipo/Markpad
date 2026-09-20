import assert from 'node:assert/strict';
import test from 'node:test';

import { callbackBodies, readSource } from './sourceTree.js';

// The effect is identified by what it does — it is the one that reads
// `onscrollsync` — not by where its text starts and stops.
//
// It used to be sliced between `'&& onscrollsync)'` and `'\n\t$effect(() => {'`,
// and both halves of that were the same kind of fragile. The start anchor had
// already drifted once, silently: the original marker spelled the whole guard
// condition, the effect gained an `editorReady &&` term when Monaco moved behind
// a dynamic import, and the slice became empty rather than failing — which is
// what the shortened anchor and its `notEqual(-1)` were added for. The end
// anchor never got that guard, and it depends on the *next* effect being
// tab-indented and spelled `$effect(() => {`; write it any other way and this
// file silently starts asserting about the rest of the component.
const editor = readSource('src/lib/components/Editor.svelte');
const syncEffects = callbackBodies(editor, '$effect').filter((body) => body.includes('onscrollsync'));
assert.equal(syncEffects.length, 1, `expected exactly one $effect reading onscrollsync (got ${syncEffects.length})`);
const syncEffect = syncEffects[0];

test('typing does not initiate split scroll synchronization', () => {
	assert.match(syncEffect, /editor\.onDidScrollChange/);
	assert.doesNotMatch(syncEffect, /onDidChangeCursorPosition/);
});

test('a click in the preview puts the Monaco caret on the matching source line', () => {
	const viewer = readSource('src/lib/MarkdownViewer.svelte');
	assert.match(viewer, /editorPane\.jumpToBufferLine\(lineCoords\.toBufferRange\(range\)\.startLine\)/);
	assert.match(viewer, /findSourceLineRange\(target\)/);

	assert.match(editor, /export function jumpToBufferLine\(line: BufferLine\)/);
	assert.match(editor, /editor\.setPosition\(\{ lineNumber, column: 1 \}\)/);
	assert.match(editor, /editor\.revealLine\(lineNumber,/);
});

test('preview scroll drives the editor from the article, and a stuck echo flag cannot swallow the next wheel', () => {
	const viewer = readSource('src/lib/MarkdownViewer.svelte');

	// The article is the only scrollport the mapping knows. Measuring
	// `e.target` would take a nested overflow (table, pre) whose
	// scrollHeight is not the document's and report "top".
	assert.match(viewer, /function previewScrollport\(/);
	assert.match(viewer, /function driveEditorFromPreview\(/);
	assert.match(viewer, /function handleScroll\(e: Event\) \{[\s\S]*?const target = previewScrollport\(e\);/);
	assert.match(viewer, /driveEditorFromPreview\(e\)/);

	// Assigning scrollTop is a no-op when the browser is already there, and a
	// no-op does not fire `scroll`. The echo flag has to clear on the next
	// frame whether or not that event arrives.
	assert.match(
		viewer,
		/isProgrammaticScroll = true;[\s\S]*?markdownBody\.scrollTop = targetScroll;[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?isProgrammaticScroll = false;/,
	);

	// Wheel is a second driver so a flag that did stay true cannot leave
	// Monaco still while the reader keeps scrolling the preview.
	assert.match(viewer, /onwheel=\{\(\) => driveEditorFromPreview\(\)\}/);
});
