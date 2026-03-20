import { Elysia, t } from "elysia";
import {
	exchangeCodeForProfile,
	getAuthorizationUrl,
} from "../../lib/microsoft-auth";
import { verifyMinecraftToken } from "../../lib/minecraft-auth";
import { authGuard } from "../../middleware/auth";
import { ApiError } from "../../middleware/error";
import {
	authenticateMinecraftProfile,
	logout,
	refreshSession,
} from "./service";

export const authRoutes = new Elysia({ prefix: "/auth" })
	// Flow A: Web OAuth — redirect to Microsoft
	.get("/login", ({ redirect }) => {
		return redirect(getAuthorizationUrl());
	})
	// Flow A: Web OAuth — callback
	.get(
		"/callback",
		async ({ query, set, cookie }) => {
			const profile = await exchangeCodeForProfile(query.code);
			const result = await authenticateMinecraftProfile(profile);
			cookie.refresh_token.set({
				value: result.refreshToken,
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				maxAge: 30 * 24 * 60 * 60, // 30 days
				path: "/",
			});
			return {
				access_token: result.accessToken,
				user: result.user,
			};
		},
		{
			query: t.Object({ code: t.String() }),
		},
	)
	// Flow B: Launcher — verify Minecraft token
	.post(
		"/verify",
		async ({ body }) => {
			const profile = await verifyMinecraftToken(body.token);
			const result = await authenticateMinecraftProfile(profile);
			return {
				access_token: result.accessToken,
				refresh_token: result.refreshToken,
				user: result.user,
			};
		},
		{
			body: t.Object({ token: t.String() }),
		},
	)
	// Refresh tokens
	.post(
		"/refresh",
		async ({ body, cookie }) => {
			const token =
				body.refresh_token ??
				(cookie.refresh_token?.value as string | undefined);
			if (!token) {
				throw new ApiError(401, "UNAUTHORIZED", "No refresh token provided");
			}
			const result = await refreshSession(token);
			if (cookie.refresh_token) {
				cookie.refresh_token.set({
					value: result.refreshToken,
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					maxAge: 30 * 24 * 60 * 60,
					path: "/",
				});
			}
			return {
				access_token: result.accessToken,
				refresh_token: result.refreshToken,
			};
		},
		{
			body: t.Object({ refresh_token: t.Optional(t.String()) }),
		},
	)
	// Logout
	.use(authGuard)
	.post("/logout", async ({ user, cookie }) => {
		await logout(user.sub);
		cookie.refresh_token?.remove();
		return { success: true };
	});
