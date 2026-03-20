function required(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export const config = {
	port: Number(process.env.PORT) || 3000,
	host: process.env.HOST || "0.0.0.0",

	databaseUrl: required("DATABASE_URL"),

	microsoftClientId: required("MICROSOFT_CLIENT_ID"),
	microsoftClientSecret: required("MICROSOFT_CLIENT_SECRET"),
	microsoftRedirectUri: required("MICROSOFT_REDIRECT_URI"),

	jwtSecret: required("JWT_SECRET"),
	jwtAccessExpiresIn: "15m",
	jwtRefreshExpiresInDays: 30,

	internalApiKey: required("INTERNAL_API_KEY"),
} as const;
