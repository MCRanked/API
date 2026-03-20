import * as jose from "jose";
import { config } from "../config";

const secret = new TextEncoder().encode(config.jwtSecret);

interface AccessTokenPayload {
	sub: string;
	minecraft_uuid: string;
	username: string;
}

export async function signAccessToken(
	payload: AccessTokenPayload,
): Promise<string> {
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(config.jwtAccessExpiresIn)
		.sign(secret);
}

export async function verifyAccessToken(
	token: string,
): Promise<AccessTokenPayload & jose.JWTPayload> {
	const { payload } = await jose.jwtVerify(token, secret);
	return payload as AccessTokenPayload & jose.JWTPayload;
}

export function generateRefreshToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(64));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function hashRefreshToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
