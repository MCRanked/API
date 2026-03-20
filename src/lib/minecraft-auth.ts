import { getMinecraftProfile, type MinecraftProfile } from "./microsoft-auth";

/**
 * Verify a Minecraft access token by calling the profile endpoint.
 * If the token is valid, we get the player's UUID and username.
 * Used by the launcher auth flow (Flow B).
 */
export async function verifyMinecraftToken(
	mcToken: string,
): Promise<MinecraftProfile> {
	return getMinecraftProfile(mcToken);
}
