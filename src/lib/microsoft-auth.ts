import { config } from "../config";

const MICROSOFT_AUTH_URL = "https://login.live.com/oauth20_authorize.srf";
const MICROSOFT_TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const XBOX_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_URL =
	"https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL =
	"https://api.minecraftservices.com/minecraft/profile";

export interface MinecraftProfile {
	id: string; // Minecraft UUID (no dashes)
	name: string; // Minecraft username
}

export function getAuthorizationUrl(): string {
	const params = new URLSearchParams({
		client_id: config.microsoftClientId,
		response_type: "code",
		redirect_uri: config.microsoftRedirectUri,
		scope: "XboxLive.signin offline_access",
	});
	return `${MICROSOFT_AUTH_URL}?${params}`;
}

export async function exchangeCodeForProfile(
	code: string,
): Promise<MinecraftProfile> {
	// Step 1: Code → Microsoft token
	const msToken = await getMicrosoftToken(code);

	// Step 2: Microsoft token → Xbox Live token
	const { token: xblToken, userHash } = await getXboxLiveToken(msToken);

	// Step 3: Xbox Live token → XSTS token
	const xstsToken = await getXstsToken(xblToken);

	// Step 4: XSTS token → Minecraft token
	const mcToken = await getMinecraftToken(xstsToken, userHash);

	// Step 5: Minecraft token → Profile
	return getMinecraftProfile(mcToken);
}

async function getMicrosoftToken(code: string): Promise<string> {
	const res = await fetch(MICROSOFT_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.microsoftClientId,
			client_secret: config.microsoftClientSecret,
			code,
			grant_type: "authorization_code",
			redirect_uri: config.microsoftRedirectUri,
		}),
	});
	const data = await res.json();
	if (!res.ok)
		throw new Error(`Microsoft token exchange failed: ${data.error}`);
	return data.access_token;
}

async function getXboxLiveToken(
	msToken: string,
): Promise<{ token: string; userHash: string }> {
	const res = await fetch(XBOX_AUTH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			Properties: {
				AuthMethod: "RPS",
				SiteName: "user.auth.xboxlive.com",
				RpsTicket: `d=${msToken}`,
			},
			RelyingParty: "http://auth.xboxlive.com",
			TokenType: "JWT",
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error("Xbox Live auth failed");
	return {
		token: data.Token,
		userHash: data.DisplayClaims.xui[0].uhs,
	};
}

async function getXstsToken(xblToken: string): Promise<string> {
	const res = await fetch(XSTS_AUTH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			Properties: {
				SandboxId: "RETAIL",
				UserTokens: [xblToken],
			},
			RelyingParty: "rp://api.minecraftservices.com/",
			TokenType: "JWT",
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error("XSTS auth failed");
	return data.Token;
}

async function getMinecraftToken(
	xstsToken: string,
	userHash: string,
): Promise<string> {
	const res = await fetch(MINECRAFT_AUTH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error("Minecraft auth failed");
	return data.access_token;
}

export async function getMinecraftProfile(
	mcToken: string,
): Promise<MinecraftProfile> {
	const res = await fetch(MINECRAFT_PROFILE_URL, {
		headers: { Authorization: `Bearer ${mcToken}` },
	});
	const data = await res.json();
	if (!res.ok) throw new Error("Failed to fetch Minecraft profile");
	return { id: data.id, name: data.name };
}
