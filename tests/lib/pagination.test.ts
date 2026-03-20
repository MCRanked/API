import { describe, expect, test } from "bun:test";
import {
	decodeCursor,
	encodeCursor,
	paginatedResponse,
} from "../../src/lib/pagination";

describe("cursor pagination", () => {
	test("encodeCursor produces base64 string", () => {
		const cursor = encodeCursor({ id: 42, elo: 1500 });
		expect(typeof cursor).toBe("string");
		expect(cursor.length).toBeGreaterThan(0);
	});

	test("decodeCursor reverses encodeCursor", () => {
		const original = { id: 42, elo: 1500 };
		const cursor = encodeCursor(original);
		const decoded = decodeCursor(cursor);
		expect(decoded).toEqual(original);
	});

	test("decodeCursor returns null for invalid input", () => {
		expect(decodeCursor("not-valid-base64!!!")).toBeNull();
		expect(decodeCursor("")).toBeNull();
	});

	test("paginatedResponse with more data (fetched limit+1 items)", () => {
		const items = [1, 2, 3, 4, 5, 6];
		const result = paginatedResponse(items, 5, (item) =>
			encodeCursor({ id: item }),
		);
		expect(result.data).toEqual([1, 2, 3, 4, 5]);
		expect(result.has_more).toBe(true);
		expect(result.next_cursor).toBeDefined();
	});

	test("paginatedResponse at end of data (fewer than limit+1)", () => {
		const items = [1, 2, 3];
		const result = paginatedResponse(items, 5, (item) =>
			encodeCursor({ id: item }),
		);
		expect(result.data).toEqual([1, 2, 3]);
		expect(result.has_more).toBe(false);
		expect(result.next_cursor).toBeNull();
	});

	test("paginatedResponse exactly limit items means no more", () => {
		const items = [1, 2, 3, 4, 5];
		const result = paginatedResponse(items, 5, (item) =>
			encodeCursor({ id: item }),
		);
		expect(result.data).toEqual([1, 2, 3, 4, 5]);
		expect(result.has_more).toBe(false);
		expect(result.next_cursor).toBeNull();
	});
});
