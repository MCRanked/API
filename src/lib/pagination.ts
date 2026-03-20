export function encodeCursor(data: Record<string, unknown>): string {
	return btoa(JSON.stringify(data));
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
	try {
		if (!cursor) return null;
		return JSON.parse(atob(cursor));
	} catch {
		return null;
	}
}

/**
 * Build a paginated response. Callers must fetch `limit + 1` items.
 * If we got the extra item, there are more results — we return only `limit` items.
 */
export function paginatedResponse<T>(
	items: T[],
	limit: number,
	cursorFn: (lastItem: T) => string,
): { data: T[]; next_cursor: string | null; has_more: boolean } {
	const hasMore = items.length > limit;
	const data = hasMore ? items.slice(0, limit) : items;
	const lastItem = data.at(-1);

	return {
		data,
		next_cursor: hasMore && lastItem ? cursorFn(lastItem) : null,
		has_more: hasMore,
	};
}
