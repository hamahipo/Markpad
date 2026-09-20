/** Which side of a split the editor takes. `settings.splitEditorSide`. */
export type SplitEditorSide = 'left' | 'right';

/**
 * This fork's split-view default: preview on the left, editor on the right.
 * `settings.splitEditorSide` starts here; Swap Panes still flips it.
 */
export const DEFAULT_SPLIT_EDITOR_SIDE: SplitEditorSide = 'right';

/**
 * Whether a newly split tab starts with its panes scroll-locked.
 * On in this fork; the title-bar toggle still writes the preference.
 */
export const DEFAULT_SPLIT_SCROLL_SYNC = true;

/**
 * Written once the fork has coerced `editor.splitScrollSync` to the default.
 * Not a preference — it records that the old stored `false` was overridden.
 */
export const SPLIT_SCROLL_SYNC_DEFAULT_ON_KEY = 'editor.splitScrollSyncDefaultOnV1';

/**
 * Cold-start answer for `settings.splitScrollSync`.
 *
 * `booleanSetting` loads the stored key as-is, so a legacy `false` (this
 * setting's old default) survived every launch and seeded new splits unlocked.
 * This fork's product default wins that race: a stored `false` does not.
 * The title-bar toggle can still turn the lock off for the session.
 */
export function coldStartSplitScrollSync(_stored: string | null): boolean {
	return DEFAULT_SPLIT_SCROLL_SYNC;
}

/**
 * Whether a restored tab's panes should be scroll-locked.
 *
 * New splits copy `splitScrollSyncPreference`. Restored splits used to keep
 * `isScrollSynced: false` whenever the snapshot was not exactly `true` — which
 * is every session written before this fork's default-on, and every tab that
 * was created `false` and then split through a path that did not re-seed.
 * A split still follows the current preference in that case; an explicit
 * `true` in the snapshot wins, and a non-split tab stays unlocked.
 *
 * This fork's default-on also wins a split whose snapshot and preference are
 * both false — the same stored-false race as {@link coldStartSplitScrollSync}.
 */
export function restoredTabScrollSync(
	savedIsSplit: boolean,
	savedIsScrollSynced: unknown,
	preference: boolean,
): boolean {
	if (savedIsScrollSynced === true) return true;
	if (savedIsSplit && (preference || DEFAULT_SPLIT_SCROLL_SYNC)) return true;
	return false;
}

/**
 * Where the splitter leaves the editor's share after travelling `fraction` of
 * the window to the RIGHT. Negative `fraction` is leftward travel.
 *
 * `splitRatio` is the EDITOR's share of the row, not the left pane's. That
 * distinction did not exist while the editor was always the left pane, and
 * `splitEditorSide` (#184) is what creates it: with the editor on the right,
 * the bar has to travel left to give it more room, so the same pointer motion
 * has to move the ratio the other way.
 *
 * Both the drag and the arrow keys go through here rather than each applying
 * the sign themselves. A splitter that followed the pointer one way and the
 * keyboard the other would be worse than one that got both wrong, and two
 * copies of `side === 'left' ? d : -d` is exactly the shape that ends up that
 * way — the second copy is written by whoever adds the next input route.
 *
 * The result is deliberately unclamped: `TabManager.setSplitRatio` holds the
 * 0.1–0.9 bounds, and a second copy of them here would be the same trap one
 * level down.
 */
export function splitRatioAfterMove(
	startRatio: number,
	fraction: number,
	editorSide: SplitEditorSide,
): number {
	return startRatio + (editorSide === 'left' ? fraction : -fraction);
}
