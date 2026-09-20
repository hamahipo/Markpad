import assert from 'node:assert/strict';
import test from 'node:test';

import { readRustBackend, readSource } from './sourceTree.js';

const backend = readRustBackend();
const viewer = readSource('src/lib/MarkdownViewer.svelte');

function showWindowSource(): string {
	const match = /pub async fn show_window\([\s\S]*?\n\}/.exec(backend);
	assert.ok(match, 'show_window is gone: this file no longer states anything');
	return match[0];
}

test('the main window is shown without being activated on a cold start', () => {
	const showWindow = showWindowSource();

	// The defect (#702): the window is built hidden and revealed once the
	// frontend mounts, seconds after launch, and the reveal called `set_focus`
	// unconditionally — pulling the user out of whatever they had switched to.
	// The label and the one-shot flag together are what make it the FIRST show
	// of the MAIN window that stays quiet.
	assert.match(showWindow, /window\.label\(\)\s*==\s*"main"/);
	assert.match(showWindow, /MAIN_WINDOW_SHOWN\.swap\(true,/);

	// Not vacuous: the other callers — a detached tab window, the close walk
	// needing its dialog visible — still activate, so this cannot pass by
	// `set_focus` having been deleted outright.
	assert.match(showWindow, /set_focus\(\)/);

	// And the quiet path returns before reaching it.
	const guard = showWindow.indexOf('return;');
	const focus = showWindow.indexOf('set_focus()');
	assert.ok(guard > 0 && guard < focus, 'the cold-start path falls through to set_focus');

	// `Window::show` on Windows is `SW_SHOW`, which activates. The quiet path
	// has to go through the no-activate helper or the return above is a no-op
	// on the platform that filed the bug.
	assert.match(showWindow, /show_without_activating\(/);
	assert.ok(
		showWindow.indexOf('show_without_activating') < guard,
		'the cold-start path shows with the activating Window::show',
	);
});

test('Windows quiet show uses SW_SHOWNOACTIVATE rather than Window::show', () => {
	assert.match(backend, /fn show_without_activating\(/);
	assert.match(backend, /SW_SHOWNOACTIVATE/);
	assert.match(backend, /fn show_hwnd_noactivate\(/);
});

test('no window builder opts out of focus', () => {
	// `.focused(false)` on a window built hidden leaves WebView2 on Windows with
	// no drop target, so every file dragged onto the window is refused (#768,
	// tauri-apps/wry#1639). Comments are stripped first: the builder explains
	// why the call is absent by naming it.
	const code = backend.replace(/\/\/.*$/gm, '');
	const found = code.match(/\.focused\(false\)/g)?.length ?? 0;
	assert.equal(found, 0, `found ${found} .focused\(false\) in the Rust backend`);
});

test('the window-state plugin does not restore visibility', () => {
	// tauri-plugin-window-state 2.x `restore_state` does this when VISIBLE is
	// in the flags and the saved window was visible (all of them are):
	//
	//     self.show()?;
	//     self.set_focus()?;
	//
	// That runs in `on_window_ready`, before the frontend mounts, and is a
	// second copy of the #702 steal. Size / position / maximized / fullscreen
	// still restore; reveal stays with `show_window`.
	const pluginSetup = /tauri_plugin_window_state::Builder[\s\S]*?\.build\(\)/.exec(backend);
	assert.ok(pluginSetup, 'window-state plugin setup is gone');
	assert.match(pluginSetup[0], /StateFlags::SIZE/);
	assert.match(pluginSetup[0], /StateFlags::POSITION/);
	assert.match(pluginSetup[0], /StateFlags::MAXIMIZED/);
	assert.match(pluginSetup[0], /StateFlags::FULLSCREEN/);
	assert.doesNotMatch(pluginSetup[0], /StateFlags::VISIBLE/);
});

test('the preview does not focus itself unless this window already has OS focus', () => {
	// HTMLElement.focus() in WebView2 activates the host HWND. An effect that
	// focuses the article whenever a tab is in reading mode would pull the
	// window back over whatever the user clicked on the taskbar.
	const effect = /\$effect\(\(\) => \{[\s\S]*?markdownBody\?\.focus\(\{ preventScroll: true \}\)[\s\S]*?\n\t\}\);/.exec(
		viewer,
	);
	assert.ok(effect, 'the preview-focus effect is gone');
	assert.match(effect[0], /isFocused/);
	assert.match(viewer, /let isFocused = \$state\(false\)/);
	assert.match(viewer, /if \(!focused\) \{/);
	assert.match(viewer, /active\.blur\(\)/);
});
