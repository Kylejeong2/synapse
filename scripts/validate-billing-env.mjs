import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const required = [
	'STRIPE_SECRET_KEY',
	'STRIPE_PRICE_ID_SUBSCRIPTION',
	'STRIPE_WEBHOOK_SECRET',
	'STRIPE_WEBHOOK_REPLAY_TOKEN',
	'STRIPE_WEBHOOK_CONVEX_TOKEN',
	'CLERK_SECRET_KEY',
	'CLERK_JWT_ISSUER_DOMAIN',
	'VITE_CONVEX_URL',
	'VITE_CLERK_PUBLISHABLE_KEY',
	'BILLING_ADMIN_USER_IDS',
];

const recommended = [
	'SERVER_URL',
	'BILLING_ALERT_WEBHOOK_URL',
	'STRIPE_WEBHOOK_REPLAY_ALLOWED_IPS',
];

const missingRequired = required.filter((key) => !process.env[key]);
const missingRecommended = recommended.filter((key) => !process.env[key]);

if (missingRequired.length > 0) {
	console.error('Missing required billing environment variables:');
	for (const key of missingRequired) {
		console.error(`- ${key}`);
	}
	process.exit(1);
}

if (missingRecommended.length > 0) {
	console.warn('Missing recommended billing environment variables:');
	for (const key of missingRecommended) {
		console.warn(`- ${key}`);
	}
}

console.log('Billing environment validation passed.');
